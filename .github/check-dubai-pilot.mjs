import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const routes=['/dubai/','/activities/dubai/categories/desert-safaris/','/activities/dubai/categories/cruises/'];
const sitemap=await readFile('dist/sitemap.xml','utf8');
for(const path of routes) assert(sitemap.includes('https://raahhi.com'+path),'Pilot route in sitemap: '+path);
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  try {res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
  catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try {
  const p=await browser.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const open=async path=>{await p.goto(origin+path);await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
  await open('/');assert(await p.locator('main a[href="/dubai/"]').count(),'Homepage discovers the planning hub');
  await open('/dubai/');assert.equal(await p.evaluate(()=>CURRENT.kind),'destinationHub');
  for(const path of ['/activities/dubai/','/holidays/dubai/','/visas/united-arab-emirates/',...routes.slice(1)]) assert(await p.locator('main a[href="'+path+'"]').count(),'Planning hub links to '+path);
  const memberships=[];
  for(const slug of ['desert-safaris','cruises']){
    const path='/activities/dubai/categories/'+slug+'/';await open(path);
    const result=await p.evaluate(()=>{
      const items=categoryTours(CURRENT.category);
      const graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
      return {dest:CURRENT.category.dest,name:CURRENT.category.name,expected:items.map(URLS.activity),actual:[...document.querySelectorAll('.category-products tbody th a')].map(a=>a.getAttribute('href')),schema:graph.find(n=>n['@type']==='ItemList').itemListElement.map(n=>n.url),faq:document.querySelector('.page.active h2')?.textContent,onlyDubai:items.every(t=>t.dest==='dubai'),country:URLS.activityCategory(categoryBySlug(CURRENT.category.slug))};
    });
    assert.equal(result.dest,'dubai');assert(result.onlyDubai&&result.expected.length>=4);
    assert.deepEqual(result.actual,result.expected);assert.deepEqual(result.schema,result.expected.map(x=>'https://raahhi.com'+x));
    assert(await p.locator('main a[href="'+result.country+'"]').count(),'City category links to its country category');
    assert.equal(await p.locator('.page.active section.detail-section').filter({has:p.getByRole('heading',{name:'Questions about '+result.name.toLowerCase(),exact:true})}).locator('details').count(),6);
    memberships.push({path,products:result.expected});
    await open(result.country);assert(await p.locator('main a[href="'+path+'"]').count(),'Country category links down to city category');
  }
  for(const {path,products} of memberships){
    for(const product of products){
      await open(product);
      assert.equal(await p.locator('#tourBreadcrumb a[href="'+path+'"]').count(),1,'Product primary category: '+product);
      const trail=await p.evaluate(()=>{
        const graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
        return {visible:[...document.querySelectorAll('#tourBreadcrumb a')].map(a=>'https://raahhi.com'+a.getAttribute('href')),schema:graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.slice(0,-1).map(n=>n.item)};
      });assert.deepEqual(trail.visible,trail.schema,'Visible and structured breadcrumb agree: '+product);
    }
  }
  for(const path of ['/activities/dubai/','/holidays/dubai/','/guides/dubai-first-visit-planning/']){await open(path);assert(await p.locator('main a[href="/dubai/"]').count(),'Existing page links to planner: '+path);}
  await open('/');await p.evaluate(()=>loadActivitySearch());
  assert(await p.evaluate(()=>rankEntries(GLOBAL_SEARCH_INDEX,'Dubai trip planner').some(e=>e.url==='/dubai/')));
  for(const width of [320,390,768,1440]){
    await p.setViewportSize({width,height:900});
    for(const path of routes){await open(path);assert.equal(await p.locator('main h1').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow: '+width+' '+path);}
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Dubai planner, complete city category membership, reciprocal links, primary breadcrumbs, search and four responsive widths');
} finally {await browser.close();server.close();}
