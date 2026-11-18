import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const registry=JSON.parse(await readFile('source/published-urls.json','utf8'));
const pages=registry.pages.filter(p=>p.kind==='activityPage');assert.equal(pages.length,6);
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
 const live=await browser.newPage(),errors=[];live.on('pageerror',e=>errors.push(e.message));
 await live.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await live.goto(origin+'/');await live.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
 const expected=await live.evaluate(()=>({tours:TOURS.map(t=>({dest:t.dest,path:URLS.activity(t)})),routes:activityPageRoutes()}));
 assert.deepEqual(new Set(expected.routes),new Set(pages.map(p=>p.path)));
 const nojs=await browser.newPage({javaScriptEnabled:false});
 await nojs.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 for(const city of ['dubai','abu-dhabi','ras-al-khaimah']){
  const products=expected.tours.filter(t=>t.dest===city).map(t=>t.path),count=Math.ceil(products.length/24),seen=[];
  for(let n=1;n<=count;n++){
   const path=n===1?'/activities/'+city+'/':'/activities/'+city+'/page/'+n+'/';
   await nojs.goto(origin+path,{waitUntil:'domcontentloaded'});
   const selector=n===1?'#tourGrid .product-card':'main .catalogue-page-grid .product-card';
   const links=await nojs.locator(selector+' h3 a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
   assert.deepEqual(links,products.slice((n-1)*24,n*24),'Exact independent HTML slice '+path);seen.push(...links);
   assert.equal(await nojs.locator('main h1').count(),1);
   const canonical=await nojs.locator('link[rel="canonical"]').getAttribute('href');assert.equal(canonical,'https://raahhi.com'+path);
   if(n>1){
    const graph=await nojs.locator('script[type="application/ld+json"]').textContent();const list=JSON.parse(graph)['@graph'].find(x=>x['@type']==='ItemList').itemListElement;
    assert.deepEqual(list.map(x=>new URL(x.url).pathname),links);assert.deepEqual(list.map(x=>x.position),links.map((_,i)=>(n-1)*24+i+1));
    assert(await nojs.locator('main a[href="/activities/'+city+'/"]').count(),'Return to start');
    assert(await nojs.locator('main a[href="/'+city+'/"]').count(),'City planning connection');
   }
   if(count>1){
    const nav=nojs.locator('main nav.catalogue-pagination').first();
    if(n<count)assert.equal(await nav.getByRole('link',{name:'Next page',exact:true}).getAttribute('href'),'/activities/'+city+'/page/'+(n+1)+'/');
    if(n>1)assert.equal(await nav.getByRole('link',{name:'Previous page',exact:true}).getAttribute('href'),n===2?'/activities/'+city+'/':'/activities/'+city+'/page/'+(n-1)+'/');
   }
  }
  assert.deepEqual(seen,products,'No omissions or overlapping page slices '+city);
 }
 await nojs.goto(origin+'/activities/dubai/');await nojs.getByRole('link',{name:'Next page',exact:true}).click();assert.equal(new URL(nojs.url()).pathname,'/activities/dubai/page/2/');
 for(const width of [320,390,768,1440]){
  await live.setViewportSize({width,height:900});await live.goto(origin+'/activities/dubai/page/2/');await live.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
  assert.equal(await live.locator('main .catalogue-page-grid .product-card').count(),24);
  assert(await live.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width);
 }
 await live.goto(origin+'/activities/dubai/');await live.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
 assert.equal(await live.locator('#tourGrid .product-card').count(),24);
 await live.evaluate(()=>loadMoreTours());assert.equal(await live.locator('#tourGrid .product-card').count(),48);
 await live.locator('#tourSearch').fill('waterparks');assert.equal(await live.locator('#tourPageLinks a').count(),0,'Filtered results do not pretend to be an unfiltered page');await live.waitForFunction(()=>document.querySelector('#tourResultsCount').textContent!=='Searching activities…');
 await live.evaluate(()=>clearTourSearch());assert.equal(await live.locator('#tourGrid .product-card').count(),24);assert(await live.locator('#tourPageLinks a').count());
 assert(await live.evaluate(()=>['/activities/dubai/page/1/','/activities/dubai/page/02/','/activities/dubai/page/99/','/activities/dubai/page/2/extra/','/activities/ras-al-khaimah/page/2/'].every(p=>routeKind(p).kind==='notfound')));
 assert.deepEqual(errors,[]);
 console.log('PASS 169 activities in independent no-JS 24-card slices; exact schema/order, self canonicals, prev/next/start, strict routes, progressive Load More, full-destination filters and four viewport widths');
}finally{await browser.close();server.close();}
