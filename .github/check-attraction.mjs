import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const route='/attractions/dubai/sky-views/';
const products=['/activities/dubai/sky-views-observatory/','/activities/dubai/sky-views-edge-walk/'];
assert((await readFile('dist/sitemap.xml','utf8')).includes('https://raahhi.com'+route));
assert((await readFile('dist/llms.txt','utf8')).includes('https://raahhi.com'+route));
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  try {res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
  catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const open=async path=>{await page.goto(origin+path);await page.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
  await open(route);
  const graph=await page.evaluate(()=>JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph']);
  assert.equal(graph.filter(n=>n['@type']==='TouristAttraction').length,1);
  assert(!graph.some(n=>n.offers||n.aggregateRating||n.review),'Planning hub invents no offer/review');
  assert.deepEqual(graph.find(n=>n['@type']==='ItemList').itemListElement.map(n=>n.url),products.map(p=>'https://raahhi.com'+p));
  assert.deepEqual(await page.locator('.attraction-products h3 a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),products);
  assert((await page.locator('#sky-views-eligibility').textContent()).includes('wording that differs'));
  assert.equal(await page.locator('main .qa-item').count(),3);
  const faq=page.locator('main .qa-item').first();await faq.locator('summary').click();assert(await faq.locator('.qa-answer').isVisible());
  for(const path of products){
    await open(path);
    assert.equal(await page.locator('#tourBreadcrumb a[href="'+route+'"]').count(),1);
    const bc=await page.evaluate(()=>({
      visible:[...document.querySelectorAll('#tourBreadcrumb a')].map(a=>'https://raahhi.com'+a.getAttribute('href')),
      schema:JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find(n=>n['@type']==='BreadcrumbList').itemListElement.slice(0,-1).map(n=>n.item)
    }));assert.deepEqual(bc.visible,bc.schema);
    const timing=await page.locator('.at-a-glance').textContent();assert(timing.includes('8:00 pm')&&timing.includes('18 November 2026'),'Source-scoped operating hours on '+path);
    assert((await page.locator('main').textContent()).includes('different participation limits'));
  }
  for(const path of ['/dubai/','/activities/dubai/','/guides/dubai-landmarks/','/compare/dubai-observation-decks/']){
    await open(path);assert(await page.locator('main a[href="'+route+'"]').count(),'Inbound discovery from '+path);
  }
  await open('/');await page.evaluate(()=>loadActivitySearch());
  assert(await page.evaluate(route=>rankEntries(GLOBAL_SEARCH_INDEX,'Sky Views planning').some(e=>e.url===route),route));
  assert.equal(await page.evaluate(()=>rankEntries(GLOBAL_SEARCH_INDEX,'Sky Views Observatory')[0].url),products[0],'Exact product intent keeps its result');
  assert(await page.evaluate(()=>routeKind('/attractions/abu-dhabi/sky-views/').kind==='notfound'&&routeKind('/attractions/dubai/sky-views/extra/').kind==='notfound'));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await open(route);
    assert.equal(await page.locator('main h1').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Sky Views attraction identity, exact visible/schema membership, product breadcrumbs, scoped operator facts, discovery, search and four viewport widths');
} finally {await browser.close();server.close();}
