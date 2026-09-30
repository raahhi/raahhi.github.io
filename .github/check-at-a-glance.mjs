import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const baseline = execFileSync('git', ['show', 'ad1e0b3dd2cbe06319a55728282b85fd0a0939f8:source/raahhi-tours52.html'], { maxBuffer: 4 * 1024 * 1024 }).toString();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/baseline/')) { res.setHeader('Content-Type', 'text/html'); res.end(baseline); return; }
  try {
    const path = url.pathname;
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(await readFile('dist' + (path.endsWith('/') ? path + 'index.html' : path)));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true });
try {
  const manifestPage = await browser.newPage();
  await manifestPage.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  // The source supports hash routing so a prefixed baseline path does not affect route resolution.
  await manifestPage.goto(base + '/baseline/source.html#home');
  const groups = await manifestPage.evaluate(() => {
    const kinds = ['activity', 'holiday', 'visa', 'addon'];
    return Object.fromEntries(kinds.map(k => [k, seoRoutes().filter(r => routeKind(r).kind === k)]));
  });
  await manifestPage.close();
  for (const [kind, routes] of Object.entries(groups)) {
    assert(routes.length > 0, kind);
    const route = routes[0];
    const old = await browser.newPage();
    await old.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await old.goto(base + '/baseline/source.html#' + route.replace(/^\/+|\/+$/g, ''));
    const oldFacts = await old.locator('.page.active .key-facts').first().innerText();
    const oldAnswer = await old.locator('.page.active .answer-lede').first().innerText();
    await old.close();
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width, height: 900 } });
      await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
      await page.goto(base + route);
      const block = page.locator('.page.active .at-a-glance');
      assert.equal(await block.count(), 1);
      assert.equal(await block.locator('.key-facts').innerText(), oldFacts, kind + ' facts preserved');
      assert.equal(await block.locator('.answer-lede').innerText(), oldAnswer, kind + ' answer preserved');
      const box = await block.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width, kind + ' block fits viewport');
      assert(await block.locator('.key-facts').evaluate(el => el.scrollWidth <= el.clientWidth), kind + ' facts do not overflow');
      await page.close();
    }
    console.log('PASS static, unchanged facts and answer, desktop/mobile: ' + kind + ' ' + route);
  }
  const page = await browser.newPage();
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await page.goto(base + groups.activity[0]);
  await page.waitForFunction(() => typeof atAGlanceHTML === 'function');
  await page.evaluate(() => {
    const block = document.querySelector('.at-a-glance');
    if (!block) throw Error('Block lost during hydration');
    const rendered = atAGlanceHTML('Test answer', [['Empty', ''], ['Known', 'Fact']], '<unverified>');
    const doc = new DOMParser().parseFromString(rendered, 'text/html');
    if (doc.querySelectorAll('dt').length !== 1 || doc.querySelector('.at-a-glance-note').textContent !== '<unverified>') throw Error('Missing-value or note escaping regression');
  });
  await page.close();
  console.log('PASS hydration, missing facts omitted and notes escaped');
} finally { await browser.close(); server.close(); }
