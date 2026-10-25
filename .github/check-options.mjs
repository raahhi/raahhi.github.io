import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const source=await readFile('source/raahhi-tours52.html','utf8');
const registry=JSON.parse(source.match(/^const PRODUCT_OPTION_CATALOGUE = (.*);$/m)[1]);
const prices=JSON.parse(source.match(/^const PRICE_CATALOGUE = (.*);$/m)[1]);
const audit=JSON.parse(await readFile('source/verification/product-options/audit.json','utf8'));
assert.deepEqual(Object.keys(registry).sort(),Object.keys(prices).sort(),'Every existing product is mapped');
assert.equal(audit.products.length,235);
const ids=new Set();let optionCount=0,pricedCount=0;
for(const [key,config] of Object.entries(registry)){
 assert(config.source.startsWith('https://www.raynatours.com/'),key+' checked source');
 for(const option of config.options){
  optionCount++;assert(!ids.has(option.id),'Unique option identity');ids.add(option.id);
  assert(option.label&&option.source&&option.checkedOn);
  assert.equal(option.policy.status,'verified','Published choices carry checked source terms');
  assert(option.policy.paragraphs.length&&option.policy.source===config.source);
  if(option.price){
   pricedCount++;assert.equal(Math.round(option.price.sourceAmount*100)-Math.round(option.price.amount*100),200);
   assert.equal(option.price.currency,'USD');assert.equal(option.price.reference,true,'Dated prices remain references');
   assert(option.pricedFor&&option.pricePax.adult>=1,'Reference date and participant basis recorded');
  }
 }
}
assert.equal(optionCount,audit.products.reduce((sum,p)=>sum+p.options,0));
assert.equal(pricedCount,audit.products.reduce((sum,p)=>sum+p.pricedOptions,0));
assert(!JSON.stringify(registry).includes('authToken'),'No guest authentication data is published');

const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.webp')?'image/webp':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
 catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const open=async route=>{await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
 const safari='evening-desert-safari',choices=registry[safari].options;
 await open('/activities/dubai/'+safari+'/');
 const picker=page.locator('[data-product-option="'+safari+'"]');
 assert.equal(await picker.locator('option').count(),choices.length+1);
 await page.locator('#tourEnqDate').fill('2027-01-15');await page.locator('#tourEnqGuests').fill('4');
 await page.locator('[data-currency-select]').selectOption('USD');
 for(const option of [choices[0],choices.at(-1)]){
  await picker.selectOption(option.id);
  const selected=page.locator('.page.active [data-selected-price-for="'+safari+'"]');
  const current=option.price&&option.pricedFor>=new Date().toISOString().slice(0,10);
  if(current){
   assert(await selected.locator('[data-usd-cents="'+Math.round(option.price.amount*100)+'"]').count()>=3,'Panel, facts, FAQ and mobile bar stay in sync');
   assert((await page.locator('.option-price-context').first().textContent()).includes('1 adult'),'Reference price is not advertised as the group total');
  }else assert((await page.locator('.page.active .bb-price').textContent()).includes('confirmed on enquiry'));
  const details=await page.locator('[data-option-details-for="'+safari+'"]').textContent();
  assert(details.includes(option.label));assert(option.inclusions.every(text=>details.includes(text)));
  const policies=await page.locator('.page.active [data-cancellation-for="'+safari+'"]').allTextContents();
  assert(policies.length>=2&&policies.every(text=>option.policy.paragraphs.every(term=>text.includes(term))),'Policy stays identical across relevant surfaces');
 }
 const chosen=choices.at(-1);
 await page.locator('[data-currency-select]').selectOption('INR');
 assert.equal(await page.locator('#tourEnqDate').inputValue(),'2027-01-15');assert.equal(await page.locator('#tourEnqGuests').inputValue(),'4');
 assert.equal(await picker.inputValue(),chosen.id);
 await page.evaluate(key=>chooseProductOption(key,'unrecognised-option'),safari);assert.equal(await picker.inputValue(),chosen.id,'Unknown IDs cannot change the selection');
 await page.evaluate(()=>enquireAboutProduct('activity','evening-desert-safari'));
 assert((await page.locator('#callbackContextDetails').textContent()).includes(chosen.label));
 await page.locator('#callbackName').fill('Test Traveller');await page.locator('#callbackPhone').fill('+971501234567');
 await page.locator('#callbackSubmit').click();
 let summary=await page.locator('#callbackSummary').textContent();
 assert(summary.includes(chosen.label)&&summary.includes('Guests: 4'));
 assert(chosen.policy.paragraphs.every(term=>summary.includes(term)),'Selected cancellation terms are copied with the enquiry');
 assert(!summary.includes('Total price:'),'No unverified group total is manufactured');
 await page.locator('#contactModal .modal-close').click();
 await picker.selectOption('');assert.equal(await page.locator('.page.active .bb-price [data-usd-cents="2665"]').count(),1,'Clearing the option restores the advertised starting price');

 await open('/holidays/dubai/dubai-grand-stopover/');
 const holiday='dubai-grand-stopover',hotel=registry[holiday].options[0];assert(hotel);
 await page.locator('[data-product-option="'+holiday+'"]').selectOption(hotel.id);
 assert((await page.locator('.page.active .bb-price').textContent()).includes('Price confirmed on enquiry for this option'));
 assert.equal(await page.locator('.page.active .bb-price [data-usd-cents]').count(),0,'Unpriced hotel preferences do not inherit a starting price');
 await page.locator('#pkgEnqTravellers').fill('3');await page.evaluate(()=>enquireAboutProduct('holiday','dubai-grand-stopover'));
 assert.equal(await page.locator('#holidayAdults').inputValue(),'3');
 await page.locator('#holidayHotelCategory').selectOption('5-star');
 assert((await page.locator('#callbackContextDetails').textContent()).includes('Price confirmed on enquiry for the requested hotel category'),'A category upgrade cannot inherit the base package price');
 await page.locator('#holidayHotel').selectOption(hotel.id);
 await page.locator('#callbackName').fill('Holiday Test');await page.locator('#callbackPhone').fill('+971501234567');
 await page.locator('#holidayAdults').fill('2');await page.locator('#holidayChildren').fill('1');await page.locator('#holidayChildren').dispatchEvent('change');
 await page.locator('#callbackSubmit').click();assert(await page.locator('#holidayChildAge0Err').isVisible(),'Missing child age is caught');
 await page.locator('#holidayChildAge0').fill('6');
 await page.locator('#holidayArrival').fill('2027-02-10');await page.locator('#holidayDeparture').fill('2027-02-09');await page.locator('#holidayDeparture').dispatchEvent('change');
 await page.locator('#callbackSubmit').click();assert(await page.locator('#holidayDepartureErr').isVisible(),'Reversed travel dates are caught');
 await page.locator('#holidayDeparture').fill('2027-02-15');
 await page.locator('#holidayRooms').fill('2');await page.locator('#holidayRoomType').selectOption('family');
 await page.locator('#holidayTransfers').selectOption('private');await page.locator('#holidayAirport').fill('DXB');
 await page.locator('#holidayMeals').fill('Vegetarian <script>example</script>');
 await page.evaluate(()=>setDisplayCurrency('BHD'));
 assert.equal(await page.locator('#holidayChildAge0').inputValue(),'6');assert.equal(await page.locator('#holidayDeparture').inputValue(),'2027-02-15');
 await page.locator('#callbackSubmit').click();summary=await page.locator('#callbackSummary').textContent();
 for(const value of ['Travellers: 3','Adults: 2','Children: 1','Children ages: 6','Rooms: 2','2027-02-10','2027-02-15','DXB',hotel.label,'Vegetarian <script>example</script>'])assert(summary.includes(value),value+' survives the holiday enquiry');
 assert.equal((summary.match(/Travellers:/g)||[]).length,1,'There is one current group count');
 assert.equal(await page.locator('#callbackSummary script').count(),0,'Free text is not interpreted as markup');
 assert(!summary.includes('USD 531.00'),'The base holiday price does not leak into the selected hotel quote');
 await page.locator('#contactModal .modal-close').click();

 await open('/visas/united-arab-emirates/');await page.evaluate(()=>openVisaEnquiry('united-arab-emirates'));
 await page.locator('#visaEnqName').fill('Visa Test');await page.locator('#visaEnqEmail').fill('test@example.com');await page.locator('#visaEnqPhone').fill('+971501234567');
 await page.locator('#visaEnqForm button[type="submit"]').click();
 assert(await page.locator('#visaEnqNationalityErr').isVisible()&&await page.locator('#visaEnqResidenceErr').isVisible(),'Nationality and residence are required');
 await page.locator('#visaEnqNationality').selectOption('IN');await page.locator('#visaEnqResidence').selectOption('AE');await page.locator('#visaEnqPurpose').selectOption('business');
 await page.locator('#visaEnqApplicants').fill('3');await page.locator('#visaEnqFlexible').uncheck();
 await page.locator('#visaEnqForm button[type="submit"]').click();assert(await page.locator('#visaEnqDateErr').isVisible());
 await page.locator('#visaEnqDate').fill('2027-03-15');await page.evaluate(()=>setDisplayCurrency('USD'));
 assert.equal(await page.locator('#visaEnqNationality').inputValue(),'IN');
 await page.locator('#visaEnqForm button[type="submit"]').click();summary=await page.locator('#visaEnqSummary').textContent();
 for(const value of ['Nationality: India','Country of residence: United Arab Emirates','Purpose of travel: Business','Applicants: 3','2027'])assert(summary.includes(value),value+' in visa summary');
 assert(summary.includes('Cancellation terms:'));
 await page.locator('#visaEnquiryModal .modal-close').click();await page.evaluate(()=>openVisaEnquiry('brazil'));
 assert.equal(await page.locator('#visaEnqNationality').inputValue(),'');assert.equal(await page.locator('#visaEnqApplicants').inputValue(),'1');
 assert((await page.locator('#visaEnqCountry').textContent()).includes('Brazil'),'No previous visa context leaks');
 await page.locator('#visaEnquiryModal .modal-close').click();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await open('/activities/dubai/'+safari+'/');await page.locator('[data-product-option="'+safari+'"]').selectOption(chosen.id);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Selected options fit '+width);
 }
 await open('/activities/dubai/aqua-fun-dubai/');assert.equal(await page.locator('.page.active [data-product-option]').count(),0,'Official-only booking remains unchanged');
 assert(!requests.some(url=>url.includes('/api/trpc')||url.includes('open.er-api.com')),'Visitor selection does not query external pricing services');
 if(process.env.RAAHHI_OPTION_SHOTS){
  const dir=process.env.RAAHHI_OPTION_SHOTS;await mkdir(dir,{recursive:true});await page.setViewportSize({width:1440,height:1100});await open('/activities/dubai/'+safari+'/');await page.locator('[data-product-option="'+safari+'"]').selectOption(choices[0].id);await page.screenshot({path:dir+'/activity-options.png'});
  await page.setViewportSize({width:390,height:900});await open('/holidays/dubai/dubai-grand-stopover/');await page.evaluate(()=>enquireAboutProduct('holiday','dubai-grand-stopover'));await page.screenshot({path:dir+'/holiday-enquiry-mobile.png'});await page.locator('#contactModal .modal-close').click();
  await open('/visas/united-arab-emirates/');await page.evaluate(()=>openVisaEnquiry('united-arab-emirates'));await page.screenshot({path:dir+'/visa-enquiry-mobile.png'});
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${Object.keys(registry).length} mappings; ${optionCount} checked choices; ${pricedCount} exact USD discounts; option/policy synchronization; holiday and visa validation, summaries, currency integrity and mobile layouts`);
}finally{await browser.close();server.close();}
