import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.png')?'image/png':'text/html');res.end(await readFile('dist'+(p.endsWith('/')?p+'index.html':p)));}
 catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const routes=['/','/visas/','/visas/united-arab-emirates/','/activities/','/activities/dubai/','/activities/dubai/evening-desert-safari/','/holidays/','/holidays/dubai/dubai-grand-stopover/','/guides/dubai-landmarks/','/contact/','/faq/','/terms/','/privacy/'];
routes.push(...['desert-safaris','city-tours','landmarks','theme-parks','water-parks','cruises','adventure','nature-wildlife','water-activities','dining-events','transfers'].map(c=>'/activities/categories/'+c+'/'));
routes.push(...['dubai-dinner-cruises','uae-water-parks','dubai-observation-decks','uae-balloon-helicopter-experiences'].map(c=>'/compare/'+c+'/'));
routes.push('/holidays/ras-al-khaimah/','/holidays/ras-al-khaimah/ras-al-khaimah-zipline-safari/','/holidays/dubai/dubai-marina-overnight/','/holidays/dubai/dubai-family-theme-park-week/');
try{
 // Force an image to fail while app.js is held back, reproducing the parser-time race.
 const early=await browser.newPage();const earlyErrors=[];early.on('pageerror',e=>earlyErrors.push(e.message));
 let release;const gate=new Promise(r=>{release=r;});
 await early.route('**/*',async r=>{
  if(r.request().url()===base+'/assets/app.js'){await gate;await r.continue();}
  else if(r.request().url().startsWith(base))await r.continue();else await r.abort();
 });
 const navigation=early.goto(base+'/');
 try{
  await early.waitForFunction(()=>window.__imgFallbackQueue?.length>0);
  assert.equal(earlyErrors.length,0,'No error before the app loads');
 }finally{release();}
 await navigation;
 await early.waitForFunction(()=>window.__imgFallbackQueue.every(el=>el.dataset.fb==='1'));
 assert.equal(earlyErrors.length,0,'Queued failures handled after hydration');
 await early.close();console.log('PASS delayed app script and early image failure regression');
 for(const width of [390,1440]){
  for(const route of routes){
   const p=await browser.newPage({viewport:{width,height:900}});const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await p.goto(base+route);await p.waitForFunction(()=>typeof router==='function');
   assert.equal(await p.locator('.page.active h1').count(),1,route);
   const overflow=await p.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert(overflow.scroll<=overflow.width+1,route+' overflow '+JSON.stringify(overflow));
   assert.equal(errors.length,0,route+' runtime errors '+errors.join('; '));
   if(route==='/'){
    assert.equal(await p.locator('#homeActivitySelection .product-card').count(),3);
    assert.equal(await p.locator('#homePackageSelection .pkg-card').count(),3);
    assert.equal(await p.locator('.home-shortcuts a').count(),3);
    assert.equal(await p.locator('.home-selection .slideshow[data-count="1"]').count(),6,'Static covers on selected products');
    const selectedLinks=await p.locator('.home-selection h3 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
    assert.equal(new Set(selectedLinks).size,6,'Six distinct published product links');
    assert(await p.evaluate(urls=>urls.every(url=>seoRoutes().includes(url)),selectedLinks));
   }
   if(route==='/activities/dubai/'){
    assert.equal(await p.getByLabel('Activity category',{exact:true}).count(),1);
    assert.equal(await p.locator('.cat-tile, #tourFilters .filter-chip').count(),0,'One category control');
    await p.getByLabel('Activity category',{exact:true}).selectOption('Landmarks');
    assert((await p.locator('#tourGridTitle').innerText()).includes('Landmarks'));
    assert(await p.locator('#tourGrid .product-card').count()>0);
    const cards=await p.locator('#tourGrid h3 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
    assert(await p.evaluate(urls=>urls.every(url=>TOURS.some(t=>URLS.activity(t)===url&&t.cat==='Landmarks'&&t.dest==='dubai')),cards));
    await p.getByLabel('Activity category',{exact:true}).selectOption('All');
   }
   const bar=p.locator('.page.active .mobile-enquiry-bar');
   if(await bar.count()){
    assert.equal(await bar.count(),1,route+' one contextual bottom bar');
    assert.equal(await p.locator('.page.active .detail-heading h1').count(),1,route+' heading above gallery');
    assert(await p.locator('.page.active .at-a-glance .key-facts dd').count()<=6,route+' compact facts');

    assert.equal(await p.locator('.page.active .detail-enquiry-actions button').count(),1,route+' title enquiry action');
    assert.equal(await bar.isVisible(),width===390,route+' mobile-only bar');
    assert.equal(await p.locator('.page.active .booking-box button').count(),1,route+' one primary enquiry action');
    if(width===390)assert.equal(await p.locator('.fab-stack').isVisible(),false,route+' callback does not overlap bar');
   }
   if(width===390){await p.getByRole('button',{name:'Open menu',exact:true}).click();assert.equal(await p.locator('#mobileNavToggle').getAttribute('aria-expanded'),'true');await p.locator('#mobile-nav').getByRole('button',{name:'Close menu',exact:true}).click();assert.equal(await p.locator('#mobileNavToggle').getAttribute('aria-expanded'),'false');}
   if(route==='/visas/united-arab-emirates/'){
    await (width===390 ? bar.getByRole('button') : p.locator('.page.active .detail-enquiry-actions button')).click();
    assert(await p.locator('#visaEnquiryModal').isVisible());assert((await p.locator('#visaEnqCountry').innerText()).includes('United Arab Emirates'));
    if(width===390){
     await p.locator('#visaEnqName').fill('Test Traveller');
     await p.locator('#visaEnqEmail').fill('test@example.com');
     await p.locator('#visaEnqPhone').fill('+971501234567');
     await p.locator('#visaOptional summary').click();
     await p.locator('#visaEnqDate').fill('2020-01-01');
     await p.locator('#visaOptional summary').click();
     await p.locator('#visaEnqForm button[type="submit"]').click();
     assert.equal(await p.locator('#visaOptional').getAttribute('open'),'');
     assert(await p.locator('#visaEnqDateErr').isVisible());
     await p.locator('#visaEnqDate').fill('2027-01-15');
     await p.locator('#visaEnqForm button[type="submit"]').click();
     const summary=await p.locator('#visaEnqSummary').innerText();
     assert(summary.includes('United Arab Emirates')&&summary.includes('2027')&&summary.includes('Page:'));
    }
    await p.locator('#visaEnquiryModal button.modal-close').click();
   }
   if(route==='/activities/dubai/evening-desert-safari/'){
    await p.locator('#tourEnqGuests').fill('4');
    await (width===390 ? bar.getByRole('button') : p.locator('.page.active .detail-enquiry-actions button')).click();
    assert(await p.locator('#contactModal').isVisible());assert((await p.locator('#callbackContextTitle').innerText()).includes('Evening Desert Safari'));assert((await p.locator('#callbackContextDetails').innerText()).includes('Guests: 4'));
    await p.locator('#contactModal button.modal-close').click();
   }
   if(route==='/holidays/dubai/dubai-family-theme-park-week/'){
    await p.locator('#pkgEnqTravellers').fill('5');
    await p.locator('#pkgEnqMonth').fill('2027-01');
    await (width===390 ? bar.getByRole('button') : p.locator('.page.active .detail-enquiry-actions button')).click();
    assert(await p.locator('#contactModal').isVisible());
    assert((await p.locator('#callbackContextTitle').innerText()).includes('Dubai Family Theme-Park Week'));
    const context=await p.locator('#callbackContextDetails').innerText();assert(context.includes('Travellers: 5')&&context.includes('2027'));
    await p.locator('#contactModal button.modal-close').click();
   }
   await p.close();console.log('PASS responsive, hydration, navigation and applicable enquiry context: '+width+' '+route);
  }
 }
}finally{await browser.close();server.close();}
