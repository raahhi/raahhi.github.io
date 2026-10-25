import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 try{
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.webp')?'image/webp':'text/html');
  res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const open=async route=>{await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
 await open('/');
 assert(await page.locator('#homeActivitySelection .price-amount').evaluateAll(elements=>elements.every(el=>parseFloat(getComputedStyle(el).fontSize)>=22)),'Card amounts have prominent typography');
 assert(await page.locator('#homeActivitySelection .price-label').evaluateAll(elements=>elements.every(el=>parseFloat(getComputedStyle(el).fontSize)>=13&&parseFloat(getComputedStyle(el).fontSize)<parseFloat(getComputedStyle(el.nextElementSibling).fontSize))),'From labels are subordinate');
 assert(await page.locator('#homeActivitySelection h3').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).minHeight==='0px')),'Short titles no longer reserve an empty second line');
 assert(await page.locator('#homeActivitySelection .pc-summary').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).webkitLineClamp==='2')),'Card descriptions have a compact two-line presentation');
 const costly=await page.evaluate(()=>{
  const holiday=[...PACKAGES].filter(p=>p.price?.amount).sort((a,b)=>b.price.amount-a.price.amount)[0];
  return URLS.holiday(holiday);
 });
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['/activities/dubai/evening-desert-safari/',costly,'/visas/united-arab-emirates/']){
   await open(route);
   const active=page.locator('.page.active');
   const gallery=await active.locator('.detail-gallery').boundingBox(),panel=await active.locator('.detail-sidebar').boundingBox();
   if(width>900){assert(panel.x>gallery.x+gallery.width,'Desktop enquiry is beside the gallery');assert(Math.abs(panel.y-gallery.y)<2,'Enquiry and gallery start together');}
   else assert(panel.y>gallery.y+gallery.height,'Mobile enquiry follows the gallery and information');
   assert.equal(await active.locator('.enquiry-journey li').count(),3,'Three accurate enquiry steps');
   assert((await active.locator('.enquiry-journey').textContent()).includes('copy'),'Journey explains the existing manual handoff');
   const nav=active.locator('.detail-section-nav');
   assert(await nav.locator('a').count()>=3,'Useful crawlable section navigation');
   const target=(await nav.locator('a').first().getAttribute('href')).slice(1);
   await nav.locator('a').first().click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),target,'Section link focuses its real destination');
   assert.equal(new URL(page.url()).pathname,route,'Section navigation keeps the product route');
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   for(const currency of ['USD','INR','BHD','JPY']){
    await page.locator('[data-currency-select]').selectOption(currency);
    assert(await active.locator('.bb-price .price-amount,.pc-price .price-amount,.mobile-enquiry-summary .price-amount').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).every(el=>el.scrollWidth<=el.clientWidth+1)),'No clipped '+currency+' amount at '+width+' on '+route);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No page overflow');
   }
   assert(await active.locator('.booking-box .price-amount').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=25),'Detail amount stays prominent');
  }
 }
 await open('/activities/dubai/');
 const links=await page.locator('#tourCategoryLinks a').evaluateAll(elements=>elements.map(el=>el.getAttribute('href')));
 assert.equal(links.length,5,'Visible category discovery shortcuts');
 assert(await page.evaluate(urls=>urls.every(url=>seoRoutes().includes(url)),links),'Shortcuts use published crawlable category routes');
 await page.locator('#tourCategoryFilter').selectOption('Landmarks');
 await page.locator('#tourSearch').fill('Museum');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 assert.equal(await page.locator('#tourCategoryFilter').inputValue(),'All');assert.equal(await page.locator('#tourSearch').inputValue(),'');
 if(process.env.RAAHHI_PRESENTATION_SHOTS){
  const dir=process.env.RAAHHI_PRESENTATION_SHOTS;await mkdir(dir,{recursive:true});
  await page.setViewportSize({width:1440,height:1100});await open('/activities/dubai/evening-desert-safari/');await page.screenshot({path:dir+'/detail-desktop.png'});
  await open('/');await page.locator('#homeActivitySelection').scrollIntoViewIfNeeded();await page.locator('#homeActivitySelection .product-card').first().waitFor();await page.locator('#homeActivitySelection').screenshot({path:dir+'/cards-desktop.png'});
  await page.setViewportSize({width:390,height:900});await open('/activities/dubai/evening-desert-safari/');await page.screenshot({path:dir+'/detail-mobile.png'});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS presentation: price hierarchy, compact cards, desktop/sidebar layout, section navigation, mobile bars, multi-currency fitting, browsing reset and enquiry steps');
}finally{await browser.close();server.close();}
