import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const cities=['abu-dhabi','ras-al-khaimah'];
const sitemap=await readFile('dist/sitemap.xml','utf8'),llms=await readFile('dist/llms.txt','utf8');
for(const city of cities){assert(sitemap.includes('https://raahhi.com/'+city+'/'));assert(llms.includes('https://raahhi.com/'+city+'/'));}
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  try {res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
  catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const open=async path=>{await page.goto(origin+path);await page.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
  await open('/');
  for(const city of cities)assert(await page.locator('main a[href="/'+city+'/"]').count(),'Homepage discovers '+city);
  const outlines=[];
  for(const city of cities){
    await open('/'+city+'/');
    const result=await page.evaluate(()=>{
      const dest=CURRENT.dest,graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
      return {kind:CURRENT.kind,dest,services:planningHubServices(dest).map(s=>'https://raahhi.com'+s.path),schema:graph.find(n=>n['@type']==='ItemList').itemListElement.map(n=>n.url),about:graph.find(n=>n['@type']==='CollectionPage').about,headings:[...document.querySelectorAll('main h2')].map(h=>h.textContent),products:TOURS.filter(t=>t.dest===dest).map(URLS.activity),packages:PACKAGES.filter(p=>p.dest===dest).map(URLS.holiday),status:TOURS.filter(t=>t.dest===dest&&['seasonal','temporarily-closed'].includes(publicStatusOf(t))).map(URLS.activity)};
    });
    assert.equal(result.kind,'destinationHub');assert.equal(result.dest,city);
    assert.deepEqual(result.schema,result.services,'Only this destination’s real services');
    assert.deepEqual(result.about,[{'@id':'https://raahhi.com/#destination-'+city}]);
    assert.equal(await page.locator('main .qa-item').count(),3);
    for(const link of result.services)assert(await page.locator('main a[href="'+new URL(link).pathname+'"]').count());
    for(const other of ['dubai',...cities].filter(x=>x!==city))assert(await page.locator('main a[href="/'+other+'/"]').count(),'Related planning hub '+other);
    for(const path of result.status)assert(await page.locator('.recorded-hub-status a[href="'+path+'"]').count(),'Recorded status kept visible: '+path);
    for(const path of [...result.products,...result.packages]){
      const html=await readFile('dist'+path+'index.html','utf8');
      assert(html.includes('href="/'+city+'/"'),'Every existing city product/stay links to planner: '+path);
    }
    outlines.push(result.headings);
    for(const kind of ['activities','holidays']){await open('/'+kind+'/'+city+'/');assert(await page.locator('main a[href="/'+city+'/"]').count(),'Service-to-planner link');}
  }
  assert.notDeepEqual(outlines[0],outlines[1],'Local planning sections have different responsibilities');
  await open('/ras-al-khaimah/');
  const rak=await page.locator('main').textContent();
  assert(rak.includes('Oman, not a local Ras Al Khaimah attraction')&&rak.includes('does not promise pickup'));
  assert(rak.includes('catalogue records, not live availability checks'));
  await open('/abu-dhabi/');
  assert((await page.locator('main').textContent()).includes('Al Ain City Tour from Dubai'));
  await open('/guides/abu-dhabi-theme-parks/');assert(await page.locator('main a[href="/abu-dhabi/"]').count());
  await open('/guides/choose-a-uae-emirate/');for(const city of cities)assert(await page.locator('main a[href="/'+city+'/"]').count());
  await open('/dubai/');for(const city of cities)assert(await page.locator('main a[href="/'+city+'/"]').count());
  await open('/');await page.evaluate(()=>loadActivitySearch());
  for(const [city,q] of [['abu-dhabi','Abu Dhabi trip planner'],['ras-al-khaimah','Ras Al Khaimah trip planner']])assert(await page.evaluate(({city,q})=>rankEntries(GLOBAL_SEARCH_INDEX,q).some(e=>e.url==='/'+city+'/'),{city,q}));
  assert(await page.evaluate(()=>routeKind('/abu-dhabi/extra/').kind==='notfound'&&routeKind('/ras-al-khaimah/extra/').kind==='notfound'));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const city of cities){await open('/'+city+'/');assert.equal(await page.locator('main h1').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width+' '+city);}
  }

  await open('/united-arab-emirates/');
  assert.equal(await page.locator('main h1').textContent(),'UAE trip planner');
  const country=await page.evaluate(()=>{
    const g=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
    return {kind:CURRENT.kind,canonical:document.querySelector('link[rel="canonical"]').href,sections:uaePlanningSections().map(s=>'https://raahhi.com'+s.path),schema:g.find(n=>n['@type']==='ItemList').itemListElement.map(n=>n.url),about:g.find(n=>n['@type']==='CollectionPage').about,country:g.find(n=>n['@type']==='Country')};
  });
  assert.equal(country.kind,'countryHub');assert.equal(country.canonical,'https://raahhi.com/united-arab-emirates/');
  assert.deepEqual(country.schema,country.sections);
  assert.deepEqual(country.about,[{'@id':'https://raahhi.com/united-arab-emirates/#country'}]);
  assert.equal(country.country.name,'United Arab Emirates');
  assert.equal(await page.locator('main .guide-card').count(),6);assert.equal(await page.locator('main .qa-item').count(),3);
  for(const url of country.sections)assert(await page.locator('main a[href="'+new URL(url).pathname+'"]').count());
  assert(sitemap.includes(country.canonical));assert(llms.includes(country.canonical));
  const body=await page.locator('main').textContent();
  assert(body.includes('not a complete guide to every emirate'));assert(body.includes('does not establish that inter-emirate transport'));
  assert(body.includes('does not refresh those underlying checks'));
  for(const path of ['/','/dubai/','/abu-dhabi/','/ras-al-khaimah/','/activities/','/holidays/','/visas/united-arab-emirates/','/guides/choose-a-uae-emirate/']){
    await open(path);assert(await page.locator('main a[href="/united-arab-emirates/"]').count(),'Country discovery from '+path);
  }
  await open('/');await page.evaluate(()=>loadActivitySearch());
  assert(await page.evaluate(()=>rankEntries(GLOBAL_SEARCH_INDEX,'UAE trip planner').some(e=>e.url==='/united-arab-emirates/')));
  assert(await page.evaluate(()=>routeKind('/united-arab-emirates/extra/').kind==='notfound'));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await open('/united-arab-emirates/');
    assert.equal(await page.locator('main h1').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Country hub overflow '+width);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS UAE country hub discovery/schema/search/responsive checks; distinct Abu Dhabi/RAK planners, exact destination service schema, complete product/stay backlinks, recorded status, departure scope, cross-city discovery, search and four viewport widths');
} finally {await browser.close();server.close();}
