import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const SOURCE_FILE = join(ROOT, 'source', 'raahhi-tours52.html');
const EXPECTED_ORIGIN = 'https://raahhi.com';
const EXPECTED_SITEMAP_URLS = 260;
// Image errors can fire while the parser is still reading the page, before app.js loads.
// hydrate() drains this queue using the real fallback handler once the app is ready.
const EARLY_IMAGE_FALLBACK = '<script data-image-fallback-bootstrap>window.__imgFallbackQueue=[];window.imgFallback=function(el){window.__imgFallbackQueue.push(el);};</script>';

function attachHydrationScripts(html) {
  return html.replace('</head>', EARLY_IMAGE_FALLBACK + '</head>')
    .replace('<!--APP_SCRIPT-->', '<script id="appScript" src="/assets/app.js"></script>');
}

function extractAppScript(source) {
  const m = source.match(/<script id="appScript">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not locate #appScript in V52 source.');
  return { tag: m[0], js: m[1] };
}

function extractEmbeddedBrandPng(source) {
  const m = source.match(/class="logo-mark"><img src="data:image\/png;base64,([^"]+)"/);
  if (!m) throw new Error('Could not locate embedded RAAHHI brand PNG.');
  return Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
}

function routeToFile(route) {
  if (route === '/') return join(DIST, 'index.html');
  const clean = route.replace(/^\/+|\/+$/g, '');
  return join(DIST, clean, 'index.html');
}

function sitemapUrlCount(xml) {
  return (xml.match(/<url>/g) || []).length;
}

const source = await readFile(SOURCE_FILE, 'utf8');
const appScript = extractAppScript(source);
const logoPng = extractEmbeddedBrandPng(source);

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(source);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const localOrigin = 'http://127.0.0.1:' + port;

const browser = await chromium.launch({ headless: true });

async function snapshot(route) {
  const page = await browser.newPage();
  try {
    await page.goto(localOrigin + route + '?__prerender', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#__prerender', { state: 'attached', timeout: 15000 });
    const detailKind = await page.evaluate(() => CURRENT.kind);
    if (['activity', 'holiday', 'visa', 'addon'].includes(detailKind)) {
      const main = page.locator('.page.active');
      const block = main.locator('.at-a-glance');
      if (await block.count() !== 1 || await block.locator('h2').textContent() !== 'At a glance') {
        throw new Error('Missing or duplicated At a glance block on ' + route);
      }
      if (!(await block.locator('.answer-lede').textContent())?.trim() || await block.locator('.key-facts dt').count() === 0) {
        throw new Error('Empty answer or facts on ' + route);
      }
      if (await block.locator('.freshness-summary').count() !== 1 || await main.locator('.sources-and-freshness').count() !== 1) {
        throw new Error('Missing source/freshness presentation on ' + route);
      }
      const dates = await main.locator('.freshness-summary time, .sources-and-freshness time').evaluateAll(els => els.map(el => ({iso:el.getAttribute('datetime'), text:el.textContent})));
      if (dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d.iso || '') || !d.text?.trim())) {
        throw new Error('Invalid recorded check date on ' + route);
      }
      const facts = await block.locator('.key-facts dd').allTextContents();
      if (facts.some(v => !v.trim() || /^[\sXx–—-]*$/.test(v))) {
        throw new Error('Empty or placeholder fact on ' + route);
      }
    }
    if (['category', 'comparison'].includes(detailKind)) {
      const result = await page.evaluate(() => {
        const expected = (CURRENT.kind === "category" ? categoryTours(CURRENT.category) : comparisonTours(CURRENT.comparison)).map(URLS.activity);
        const actual = [...document.querySelectorAll('.category-products tbody a, .comparison-table tbody th a')].map(a => a.getAttribute('href'));
        const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
        const schema = graph.find(n => n['@type'] === 'ItemList');
        return {selectionValid:CURRENT.kind !== "comparison" || CURRENT.comparison.ids().length === expected.length, expected, actual, schema: schema.itemListElement.map(n => n.url || n.item?.url), count:schema.numberOfItems};
      });
      if(!result.selectionValid || result.expected.length < 3 || result.actual.length !== result.expected.length || new Set(result.actual).size !== result.actual.length || result.expected.some(url => !result.actual.includes(url))) {
        throw new Error('Incomplete collection product list: ' + route);
      }
      if(result.count !== result.expected.length || result.expected.some(url => !result.schema.includes(EXPECTED_ORIGIN + url))) throw new Error('Collection schema mismatch: ' + route);
    }
    const planning = await page.locator('.page.active .planning-links').evaluateAll(nodes => nodes.map(node => ({
      label:node.getAttribute('aria-label'),
      links:[...node.querySelectorAll('a')].map(a => ({href:a.getAttribute('href'), text:a.textContent.trim()})),
      visible:!node.closest('[hidden]') && node.getBoundingClientRect().width > 0
    })));
    const raw = await page.locator('#__prerender').textContent();
    if (!raw) throw new Error('Missing prerender payload for ' + route);
    return {...JSON.parse(raw), planning};
  } finally {
    await page.close();
  }
}

async function writeBrandAssets() {
  await mkdir(join(DIST, 'assets'), { recursive: true });
  await writeFile(join(DIST, 'assets', 'raahhi-tours-logo.png'), logoPng);

  const dataUri = 'data:image/png;base64,' + logoPng.toString('base64');
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  try {
    await page.setContent('<!doctype html><html><head><style>html,body{margin:0;width:512px;height:512px;overflow:hidden;background:#0F1E36}body{display:flex;align-items:center;justify-content:center}img{width:390px;height:auto;display:block}</style></head><body><img src="' + dataUri + '" alt=""></body></html>', { waitUntil: 'load' });
    await page.screenshot({ path: join(DIST, 'assets', 'raahhi-tours-favicon.png'), type: 'png' });
  } finally {
    await page.close();
  }
}

try {
  const home = await snapshot('/');
  if (home.siteUrl !== EXPECTED_ORIGIN) {
    throw new Error('Production origin mismatch: expected ' + EXPECTED_ORIGIN + ', got ' + home.siteUrl);
  }
  if (!Array.isArray(home.routes) || home.routes.length < EXPECTED_SITEMAP_URLS) {
    throw new Error('Unexpected route manifest: ' + (home.routes?.length ?? 'missing') + ' routes');
  }
  if (!home.sitemapXml || sitemapUrlCount(home.sitemapXml) !== EXPECTED_SITEMAP_URLS) {
    throw new Error('Expected ' + EXPECTED_SITEMAP_URLS + ' sitemap URLs, found ' + (home.sitemapXml ? sitemapUrlCount(home.sitemapXml) : 0));
  }
  if (!home.robotsTxt?.includes('Sitemap: ' + EXPECTED_ORIGIN + '/sitemap.xml')) {
    throw new Error('robots.txt does not point to the production sitemap.');
  }
  for (const bot of ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User']) {
    if (!home.robotsTxt.includes('User-agent: ' + bot + '\nAllow: /\n')) {
      throw new Error('Missing explicit retrieval crawler policy for ' + bot);
    }
  }

  const routeResults = new Map([['/', home]]);
  const queue = home.routes.filter(r => r !== '/');
  const workers = Math.min(6, queue.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= queue.length) break;
      const route = queue[i];
      routeResults.set(route, await snapshot(route));
    }
  }));

  // Planning links must lead to published routes and remain available without opening a disclosure.
  const published = new Set(home.routes), planningEdges = [];
  for (const [route, data] of routeResults) {
    for (const nav of data.planning || []) {
      if(!nav.visible || !nav.label || !nav.links.length) throw new Error('Hidden or empty planning links on ' + route);
      const seen = new Set();
      for (const link of nav.links) {
        if(!published.has(link.href) || link.href === route || !link.text || seen.has(link.href)) {
          throw new Error('Invalid planning link from ' + route + ' to ' + link.href);
        }
        seen.add(link.href);
        planningEdges.push({from:route, to:link.href});
      }
    }
    if (['activity', 'holiday', 'guide', 'category', 'comparison', 'activityDest', 'holidayDest', 'addon'].includes(data.kind) && !(data.planning || []).length) {
      throw new Error('Missing contextual planning links on ' + route);
    }
  }
  for (const route of home.routes) {
    const data = routeResults.get(route);
    if (!data?.html) throw new Error('No HTML snapshot for ' + route);
    if (route === '/visas/') {
      const visaRoutes = home.routes.filter(r => /^\/visas\/[^/]+\/$/.test(r));
      const index = data.html.match(/<nav\b[^>]*id="visaDestinationIndex"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
      const links = new Set([...((index || '').matchAll(/<a\b[^>]*href="([^"]+)"/g))].map(m => m[1]));
      if (visaRoutes.length !== 41 || links.size !== visaRoutes.length || visaRoutes.some(r => !links.has(r))) {
        throw new Error('Visa destination index must contain all 41 visa routes as anchor links.');
      }
    }
    const html = attachHydrationScripts(data.html);
    if (!html.includes('src="/assets/app.js"')) throw new Error('Hydration script missing from ' + route);
    if (!html.includes('data-prerendered=')) throw new Error('Static marker missing from ' + route);
    if (data.robots === 'index,follow') {
      const canonical = EXPECTED_ORIGIN + route;
      if (!html.includes('rel="canonical" href="' + canonical + '"')) throw new Error('Canonical mismatch on ' + route);
      if (!html.includes('property="og:url" content="' + canonical + '"')) throw new Error('og:url mismatch on ' + route);
    }
    const file = routeToFile(route);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
  }

  const notFound = await snapshot('/404.html');
  const notFoundHtml = attachHydrationScripts(notFound.html);
  await writeFile(join(DIST, '404.html'), notFoundHtml, 'utf8');

  await writeBrandAssets();
  await writeFile(join(DIST, 'assets', 'app.js'), appScript.js, 'utf8');
  await writeFile(join(DIST, 'robots.txt'), home.robotsTxt, 'utf8');
  await writeFile(join(DIST, 'sitemap.xml'), home.sitemapXml, 'utf8');
  await writeFile(join(DIST, 'llms.txt'), home.llmsTxt || '', 'utf8');
  await writeFile(join(DIST, '.nojekyll'), '', 'utf8');
  await writeFile(join(DIST, 'CNAME'), 'raahhi.com\n', 'utf8');

  const report = {
    source: 'raahhi-tours52.html',
    productionOrigin: home.siteUrl,
    generatedRoutes: home.routes.length,
    sitemapUrls: sitemapUrlCount(home.sitemapXml),
    intendedIndexableUrls: EXPECTED_SITEMAP_URLS,
    generated404: true,
    comparisonPages: [...routeResults.values()].filter(r => r.kind === "comparison").length,
    categoryPages: [...routeResults.values()].filter(r => r.kind === "category").length,
    planningLinkPages: [...routeResults.values()].filter(r => r.planning?.length).length,
    planningLinks: planningEdges.length,
    atAGlancePages: [...routeResults.values()].filter(r => ['activity', 'holiday', 'visa', 'addon'].includes(r.kind)).length,
    sourcesAndFreshnessPages: [...routeResults.values()].filter(r => ['activity', 'holiday', 'visa', 'addon'].includes(r.kind)).length
  };
  await writeFile(join(DIST, 'build-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
