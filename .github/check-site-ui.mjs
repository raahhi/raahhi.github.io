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
   if(width===390){await p.getByRole('button',{name:'Open menu',exact:true}).click();assert.equal(await p.locator('#mobileNavToggle').getAttribute('aria-expanded'),'true');await p.locator('#mobile-nav').getByRole('button',{name:'Close menu',exact:true}).click();assert.equal(await p.locator('#mobileNavToggle').getAttribute('aria-expanded'),'false');}
   if(route==='/visas/united-arab-emirates/'){
    await p.getByRole('button',{name:'Start Visa Enquiry',exact:true}).click();
    assert(await p.locator('#visaEnquiryModal').isVisible());assert((await p.locator('#visaEnqCountry').innerText()).includes('United Arab Emirates'));
    await p.locator('#visaEnquiryModal button.modal-close').click();
   }
   if(route==='/activities/dubai/evening-desert-safari/'){
    await p.getByRole('button',{name:'Request to Book',exact:true}).click();
    assert(await p.locator('#contactModal').isVisible());assert((await p.locator('#callbackContextTitle').innerText()).includes('Evening Desert Safari'));
    await p.locator('#contactModal button.modal-close').click();
   }
   await p.close();console.log('PASS responsive, hydration, navigation and applicable enquiry context: '+width+' '+route);
  }
 }
}finally{await browser.close();server.close();}
