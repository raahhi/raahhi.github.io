import {mockEnquiryDelivery} from './enquiry-test-fixture.mjs';
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
const ids=new Set();let optionCount=0,pricedCount=0,verifiedPolicyCount=0;
const abuDhabiHolidays=['abu-dhabi-explorer-dubai-iconic','abu-dhabi-express-getaway','abu-dhabi-grand-with-dubai-day','abu-dhabi-stay-play'];
const dubaiQuoteChecks={
 'dubai-easter-short-break':{text:/Available Easter departure dates/,itinerary:/optional Atlantis Aquaventure, quoted separately/i},
 'dubai-group-indian-meals':{text:/available group departure dates, minimum group size/,stale:/Fixed Group Dates|Indian-style BBQ/},
 'dubai-jain-comfort':{itinerary:/optional Abu Dhabi tour with a possible BAPS Hindu Mandir photo stop/,stale:/Dubai city tour including BAPS|Royal Ascot \/ Ascot Hotel|Sea View Hotel Dubai/},
 'dubai-premium-kosher':{text:/kosher certification/,stale:/Private desert safari|Marina cruise with kosher menu|Grand Millennium Hotel|Hilton Garden Inn Dubai Jumeirah/},
 'dubai-sky-sea-adventure':{itinerary:/snorkeling at Deep Dive Dubai.*Planned evening desert safari/s,stale:/Scuba dive|Overnight desert safari|Private yacht charter with watersports/},
 'dubai-city-safari-value':{text:/which sightseeing journeys are shared and whether both airport transfers are private/},
 'dubai-downtown-discovery':{text:/Dubai Creek dhow cruise.*one-way return from Dubai Mall/s},
 'dubai-family-discovery-waterpark':{text:/child ages, supervision.*Wild Wadi/s},
 'dubai-family-theme-park-week':{text:/Select one Dubai Parks and Resorts park.*museum transfer is private/s},
 'dubai-gardens-seasonal-escape':{text:/how you get from Miracle Garden to Global Village, and the one-way hotel return/},
 'dubai-grand-stopover':{text:/Dubai Aquarium admission or evening safari dinner is available as a separate quoted item/},
 'dubai-marina-overnight':{text:/departure pier, check-in time and dinner menu/,stale:/arrival before 4 pm/},
 'dubai-skyline-overnight':{text:/the separate Dubai Fountain Lake Ride ticket/},
 'dubai-waterpark-city-explorer':{itinerary:/Ask whether an evening desert safari and dinner can be included in your quote/},
 'ultimate-dubai-explorer':{text:/entry versus a sightseeing stop at Dubai Frame and Qasr Al Watan/},
};
for(const [key,config] of Object.entries(registry)){
 assert(config.source.startsWith('https://www.raynatours.com/'),key+' checked source');
 for(const option of config.options){
  optionCount++;assert(!ids.has(option.id),'Unique option identity');ids.add(option.id);
  assert(option.label&&option.source&&option.checkedOn);
  if(abuDhabiHolidays.includes(key)||Object.hasOwn(dubaiQuoteChecks,key)){
   assert.equal(option.policy.status,'unconfirmed');
   assert.deepEqual(option.policy.paragraphs,[]);
  }else{
   assert.equal(option.policy.status,'verified','Published choices carry checked source terms');
   assert(option.policy.paragraphs.length&&option.policy.source===config.source);
   verifiedPolicyCount++;
  }
  if(option.price){
   pricedCount++;assert.equal(Math.round(option.price.sourceAmount*100)-Math.round(option.price.amount*100),200);
   assert.equal(option.price.currency,'USD');assert.equal(option.price.reference,true,'Dated prices remain references');
   assert(option.pricedFor&&option.pricePax.adult>=1,'Reference date and participant basis recorded');
  }
 }
}
assert.equal(optionCount,audit.products.reduce((sum,p)=>sum+p.options,0));
assert.equal(pricedCount,audit.products.reduce((sum,p)=>sum+p.pricedOptions,0));
assert.equal(verifiedPolicyCount,audit.products.reduce((sum,p)=>sum+p.verifiedOptionPolicies,0));
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
 const submissions=await mockEnquiryDelivery(page);
 const enterText=async (selector,value)=>{
  const field=page.locator(selector);
  await field.fill(value);
  assert.equal(await field.inputValue(),value);
 };
 const open=async route=>{await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
 const waitForProduct=async path=>{
  await page.waitForURL(base+path);
  await page.waitForFunction(()=>typeof chooseProductOption==='function'&&document.querySelector('[data-currency-select]')?.disabled===false);
 };
 const safari='evening-desert-safari',choices=registry[safari].options;
 await open('/activities/dubai/'+safari+'/');
 const picker=page.locator('[data-product-option="'+safari+'"]');
 assert.equal(await picker.locator('option').count(),choices.length+1);
 await page.locator('#tourEnqDate').fill('2027-01-15');const guests=page.locator('#tourEnqGuests');
 for(let count=Number(await guests.inputValue());count<4;count++) await guests.press('ArrowUp');
 assert.equal(await guests.inputValue(),'4','Guest input accepted before changing currency or option');
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
 await enterText('#callbackName','Test Traveller');await enterText('#callbackPhone','+971501234567');
 await page.locator('#callbackSubmit').click();
 await page.locator('#callbackDone').waitFor({state:'visible'});let summary=await page.locator('#callbackSummary').textContent();
 assert(summary.includes(chosen.label)&&summary.includes('Guests: 4'));
 assert(chosen.policy.paragraphs.every(term=>summary.includes(term)),'Selected cancellation terms are copied with the enquiry');
 assert(!summary.includes('Total price:'),'No unverified group total is manufactured');
 await page.locator('#contactModal .modal-close').click();
 await picker.selectOption('');assert.equal(await page.locator('.page.active .bb-price [data-usd-cents="'+Math.round(prices[safari].amount*100)+'"]').count(),1,'Clearing the option restores the advertised starting price');

 // Take the real mobile path into the comparison, then verify every overnight choice.
 const safariNames=['morning','evening','premium','overnight'];
 await open('/activities/dubai/');
 for(const name of safariNames){
  const id=name+'-desert-safari';
  const heading=page.locator('h3 a[href="/activities/dubai/'+id+'/"]');
  const card=page.locator('.page.active .product-card').filter({has:heading});
  assert.equal(await card.locator('[data-usd-cents="'+Math.round(prices[id].amount*100)+'"]').count(),1);
 }
 await open('/guides/dubai-desert-safari/');
 await page.getByRole('link',{name:'Compare Dubai safari options and open a listing to enquire'}).click();
 await page.waitForURL(base+'/activities/categories/desert-safaris/#safaris-dubai');
 await page.locator('#safaris-dubai tr').first().waitFor({state:'visible'});
 for(const name of safariNames){
  const cents=Math.round(prices[name+'-desert-safari'].amount*100);
  const path='/activities/dubai/'+name+'-desert-safari/';
  assert.equal(await page.locator('#safaris-dubai tr').filter({has:page.locator('a[href="'+path+'"]')}).locator('[data-usd-cents="'+cents+'"]').count(),1);
 }
 const overnight='overnight-desert-safari';
 await page.locator('#safaris-dubai a[href="/activities/dubai/'+overnight+'/"]').click();
 await waitForProduct('/activities/dubai/'+overnight+'/');
 const nightPicker=page.locator('[data-product-option="'+overnight+'"]');
 const timings=page.locator('[data-overnight-fact=timing]');
 const transfers=page.locator('[data-overnight-fact=transfer]');
 assert.equal(await page.locator('.page.active .bb-price [data-usd-cents="'+Math.round(prices[overnight].amount*100)+'"]').count(),1);
 assert.deepEqual(await timings.allTextContents(),['Timing varies by option.']);
 assert((await transfers.allTextContents()).every(x=>/var(y|ies) by option/.test(x)));
 assert.equal(await nightPicker.locator('option').count(),10);
 for(const option of registry[overnight].options){
  await nightPicker.selectOption(option.id);
  assert.deepEqual(await timings.allTextContents(),[option.time]);
  assert.deepEqual(await transfers.allTextContents(),[option.transferNote,option.transferNote]);
  const detail=await page.locator('[data-option-details-for="'+overnight+'"]').textContent();
  assert(detail.includes(option.transferNote)&&detail.includes(option.time));
  assert(option.inclusions.every(x=>detail.includes(x)));
  const noTransfer=option.label.endsWith('Without transfer');
  if(noTransfer){
   assert(detail.includes('Hotel pickup is not included.'));
   assert(!/shared transfers to camp from hotel|return hotel transfer/i.test(detail));
   assert.equal(option.time.startsWith('Activity starts at 22:00'),!option.label.includes('Morning Safari Adventure'));
  } else assert.match(option.time,/20:00–21:00.*08:00–09:00/);
  const notes=await page.locator('[data-cancellation-for="'+overnight+'"]').allTextContents();
  assert(notes.length>=2&&notes.every(x=>option.policy.paragraphs.every(term=>x.includes(term))));
 }
 const shuttle=registry[overnight].options.find(x=>x.label.startsWith('Desert Safari & Overnight Camp')&&x.label.endsWith('Without transfer'));
 await nightPicker.selectOption(shuttle.id);
 const overnightGuests=page.locator('#tourEnqGuests');
 await overnightGuests.press('ArrowUp');await overnightGuests.press('ArrowUp');
 assert.equal(await overnightGuests.inputValue(),'4');
 await page.locator('.mobile-enquiry-bar button').click();
 const context=await page.locator('#callbackContextDetails').textContent();
 assert(context.includes(shuttle.label)&&context.includes('Guests: 4')&&context.includes('22:00')&&context.includes('parking point'));
 const submissionCount=submissions.length;
 await enterText('#callbackName','Overnight Test');await enterText('#callbackPhone','+971501234567');
 await page.locator('#callbackSubmit').click();
 await page.locator('#callbackDone').waitFor({state:'visible'});
 assert.equal(submissions.length,submissionCount+1);
 const payload=submissions.at(-1), details=Object.fromEntries(payload.details);
 assert.equal(payload.category,'Activities');
 assert.equal(payload.kind,'activity');
 assert.equal(payload.page,'https://raahhi.com/activities/dubai/overnight-desert-safari/');
 assert.equal(details.Guests,'4');
 assert.equal(details['Selected option'],shuttle.label);
 assert.equal(details['Option reference'],shuttle.id);
 assert.equal(details['Pickup and meeting'],shuttle.transferNote);
 assert.equal(details['Option timing'],shuttle.time);
 await page.locator('#contactModal .modal-close').click();
 await nightPicker.selectOption('');
 assert.deepEqual(await timings.allTextContents(),['Timing varies by option.']);
 for(const [id,prefix,privateTime,feature] of [
  [safari,'Evening Safari: Premium','16:30','At reserved area'],
  ['premium-desert-safari','Standalone Premium Safari','15:30','Tanura show'],
 ]){
  await open('/activities/dubai/'+id+'/');
  const compare=page.getByRole('heading',{name:'Compare the two Premium safari listings'});
  assert.equal(await compare.count(),1);
  for(const transfer of ['Shared','Private']){
   const option=registry[id].options.find(o=>o.label===prefix+' · '+transfer+' transfer');assert(option);
   await page.locator('[data-product-option="'+id+'"]').selectOption(option.id);
   const detail=await page.locator('[data-option-details-for="'+id+'"]').textContent();
   assert(detail.includes(transfer==='Private'?privateTime:'15:00–15:30')&&detail.includes(feature));
  }
 }

 await open('/activities/dubai/');
 const decksLink=page.getByRole('link',{name:'Compare Dubai observation decks',exact:true});
 assert.equal(await decksLink.getAttribute('href'),'/compare/dubai-observation-decks/');
 await decksLink.click();
 await page.waitForURL(base+'/compare/dubai-observation-decks/',{waitUntil:'domcontentloaded'});
 const deckRows=page.locator('.comparison-table tbody tr');
 await deckRows.first().waitFor({state:'visible'});
 assert.equal(await deckRows.count(),3);
 const burj=await deckRows.filter({has:page.locator('a[href="/activities/dubai/burj-khalifa-top/"]')}).textContent();
 assert.match(burj,/124 and 125/);
 assert.doesNotMatch(burj,/148|Rooftop/);
 const palm=await deckRows.filter({has:page.locator('a[href="/activities/dubai/the-view-at-the-palm/"]')}).textContent();
 assert.match(palm,/Level 52.*Prime or Non-Prime/);
 assert.doesNotMatch(palm,/Level 54|VIP lounge/);
 const sky=deckRows.filter({has:page.locator('a[href="/activities/dubai/sky-views-observatory/"]')});
 assert.match(await sky.textContent(),/One Glass Slide ride.*No transfer/);
 await sky.getByRole('link',{name:'Sky Views Observatory'}).click();
 await waitForProduct('/activities/dubai/sky-views-observatory/');
 const skyOption=registry['sky-views-observatory'].options[0];
 await page.locator('[data-product-option="sky-views-observatory"]').selectOption(skyOption.id);
 await page.locator('.mobile-enquiry-bar button').click();
 assert.match(await page.locator('#callbackContextDetails').textContent(),/Sky Views Observatory \+ Glass Slide/);
 const beforeSky=submissions.length;
 await enterText('#callbackName','Observation Deck Test');
 await enterText('#callbackPhone','+971501234567');
 await page.locator('#callbackSubmit').click();
 await page.locator('#callbackDone').waitFor({state:'visible'});
 assert.equal(submissions.length,beforeSky+1);
 const skyPayload=submissions.at(-1), skyDetails=Object.fromEntries(skyPayload.details);
 assert.equal(skyPayload.category,'Activities');
 assert.equal(skyPayload.page,'https://raahhi.com/activities/dubai/sky-views-observatory/');
 assert.equal(skyDetails['Option reference'],skyOption.id);
 assert.equal(skyDetails['Selected option'],skyOption.label);
 await page.locator('#contactModal .modal-close').click();

 await open('/holidays/dubai/');
 const chooser=page.getByRole('region',{name:'Choose a Dubai holiday package'});
 assert.equal(await chooser.locator('.package-choices a').count(),6);
 const cityBreaks=chooser.locator('.comparison-choice').filter({has:page.getByRole('heading',{name:'Three-night city breaks'})});
 assert.deepEqual(await cityBreaks.getByRole('link').allTextContents(),['Dubai Grand Stopover Experience','Dubai Downtown Discovery']);
 assert.match(await cityBreaks.textContent(),/Abu Dhabi day trip.*Burj Khalifa/s);
 const transferFaq=page.locator('#pkgDestFaq .qa-item').filter({hasText:'Are airport transfers and sightseeing transfers the same?'});
 await transferFaq.locator('summary').click();
 assert.equal(await transferFaq.getByRole('link',{name:'package comparison'}).getAttribute('href'),'#pkgDestGuideTitle');
 await chooser.getByRole('link',{name:'Compare all 15 Dubai packages'}).click();
 assert.equal(new URL(page.url()).hash,'#pkgDestGuideTitle');
 const packageRows=page.locator('#pkgDestGuide tbody tr');
 assert.equal(await packageRows.count(),15);
 const marina='dubai-marina-overnight';
 const marinaRow=packageRows.filter({has:page.locator('a[href="/holidays/dubai/'+marina+'/"]')});
 assert.equal(await marinaRow.locator('[data-usd-cents="'+Math.round(prices[marina].amount*100)+'"]').count(),1);
 assert.match(await marinaRow.locator('.price-basis').textContent(),/per person.*occupancy/);
 const easter=packageRows.filter({has:page.locator('a[href="/holidays/dubai/dubai-easter-short-break/"]')});
 assert.match(await easter.textContent(),/Price confirmed on enquiry/);
 assert.equal(await easter.locator('[data-usd-cents]').count(),0);
 await chooser.getByRole('link',{name:'Dubai Marina Overnight Escape'}).click();
 await waitForProduct('/holidays/dubai/'+marina+'/');
 const marinaHotel=registry[marina].options[0];
 await page.locator('[data-product-option="'+marina+'"]').selectOption(marinaHotel.id);
 await page.locator('.mobile-enquiry-bar button').click();
 await enterText('#callbackName','Dubai Package Test');
 await enterText('#callbackPhone','+971501234567');
 const beforePackage=submissions.length;
 await page.locator('#callbackSubmit').click();
 await page.locator('#callbackDone').waitFor({state:'visible'});
 assert.equal(submissions.length,beforePackage+1);
 const packagePayload=submissions.at(-1),packageDetails=Object.fromEntries(packagePayload.details);
 assert.equal(packagePayload.category,'Packages');
 assert.equal(packagePayload.page,'https://raahhi.com/holidays/dubai/'+marina+'/');
 assert.equal(packageDetails['Option reference'],marinaHotel.id);
 assert.equal(packageDetails['Selected option'],marinaHotel.label);
 await page.locator('#contactModal .modal-close').click();

 for(const [city,count] of [['abu-dhabi',4],['ras-al-khaimah',6]]){
  await open('/holidays/'+city+'/');
  const rows=page.locator('#pkgDestGuide tbody tr');
  assert.equal(await rows.count(),count);
  const packagePaths=await rows.locator('th a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  for(const path of packagePaths){
   const id=path.split('/').filter(Boolean).at(-1);
   const row=rows.filter({has:page.locator('a[href="'+path+'"]')});
   const price=prices[id];
   if(price?.amount>0){
    assert.equal(await row.locator('[data-usd-cents="'+Math.round(price.amount*100)+'"]').count(),1);
    assert.match(await row.locator('.price-basis').textContent(),/per person/);
   }else assert.match(await row.textContent(),/Price confirmed on enquiry/);
  }
  if(city==='abu-dhabi'){
   assert.equal(await page.getByRole('link',{name:'Compare Abu Dhabi theme parks for your holiday'}).getAttribute('href'),'/guides/abu-dhabi-theme-parks/');
   assert.equal(await page.getByRole('columnheader',{name:'Planned stops'}).count(),1);
  }
 }
 for(const id of abuDhabiHolidays){
  const path='/holidays/abu-dhabi/'+id+'/';
  await open(path);
  assert.equal(registry[id].defaultPolicy.status,'unconfirmed');
  assert.equal(registry[id].options.length,1);
  assert.match(await page.locator('.acc-options').textContent(),/5 star hotel.*W Abu Dhabi/s);
  assert.match(await page.locator('.at-a-glance .key-facts').textContent(),/AccommodationHotel options.*MealsConfirm which breakfasts or other meals/s);
  const quote=page.locator('#holiday-quote-details');
  assert.match(await quote.textContent(),/admission|ticket/i);
  assert.match(await quote.textContent(),/transfers/i);
  assert.match(await page.locator('main').textContent(),/cancellation, amendment and refund conditions will be confirmed/i);
  assert(!/Radisson Blu Hotel, Abu Dhabi Yas Island|100% of the booking amount/.test(await page.locator('main').textContent()));
  const structured=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
  assert.match(structured.find(n=>n['@type']==='TouristTrip').description,/Hotel, meals, tickets and transfers are confirmed in your quote/);
  assert(!/Radisson Blu Hotel, Abu Dhabi Yas Island/.test(JSON.stringify(structured)));
  await page.locator('.mobile-enquiry-bar button').click();
  assert.deepEqual(await page.locator('#holidayHotel option').allTextContents(),['Help me decide',registry[id].options[0].label]);
  assert.equal(await page.locator('#holidayTransfers option').first().textContent(),'Confirm in my quote');
  await page.locator('#contactModal .modal-close').click();
 }
 await open('/holidays/dubai/');
 assert.equal(await page.getByRole('columnheader',{name:'Planned stops'}).count(),1);
 const plannedRows=page.locator('#pkgDestGuide tbody tr');
 assert.equal(await plannedRows.count(),Object.keys(dubaiQuoteChecks).length);
 assert((await plannedRows.locator('td:last-child').allTextContents()).every(text=>text.trim().length>0));
 for(const [slug,expected] of Object.entries(dubaiQuoteChecks)){
  const path='/holidays/dubai/'+slug+'/';
  await open(path);
  const main=page.locator('#pkgDetailMain');
  const quote=main.locator('#holiday-quote-details');
  assert.match(await quote.textContent(),/transfers?/i,path);
  if(expected.text) assert.match(await quote.textContent(),expected.text,path);
  if(expected.itinerary) assert.match((await main.locator('.itin-item p').allTextContents()).join(' '),expected.itinerary,path);
  assert.equal(registry[slug].defaultPolicy.status,'unconfirmed',path);
  const graph=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
  const trip=graph.find(n=>n['@type']==='TouristTrip');
  assert.equal(trip.offers?.price,prices[slug].amount??undefined,path);
  const visible=await main.textContent();
  assert.match(visible,/What will my holiday quote confirm.*cancellation|cancellation.*What will my holiday quote confirm/is,path);
  assert(!visible.includes('100% of the booking amount'),path);
  if(expected.stale)assert(!expected.stale.test(visible)&&!expected.stale.test(JSON.stringify(trip)),path);
  await page.locator('.mobile-enquiry-bar button').click();
  assert.deepEqual(await page.locator('#holidayHotel option').allTextContents(),['Help me decide',...registry[slug].options.map(o=>o.label)],path);
  assert.equal(await page.locator('#holidayTransfers option').first().textContent(),'Confirm in my quote');
  await page.locator('#contactModal .modal-close').click();
 }
 await open('/activities/ras-al-khaimah/');
 const musandam='musandam-dibba-tour',musandamPath='/activities/ras-al-khaimah/'+musandam+'/';
 await page.locator('.product-card h3 a[href="'+musandamPath+'"]').click();
 await waitForProduct(musandamPath);
 const place=page.locator('.key-facts dt').filter({hasText:/^Destination$/}).locator('xpath=following-sibling::dd[1]');
 assert.equal(await place.textContent(),'Musandam, Oman');
 const shared=registry[musandam].options.find(option=>option.label.endsWith('Sharing transfer'));
 await page.locator('[data-product-option="'+musandam+'"]').selectOption(shared.id);
 await page.locator('.mobile-enquiry-bar button').click();
 await enterText('#callbackName','Musandam Test');
 await enterText('#callbackPhone','+971501234567');
 const beforeMusandam=submissions.length;
 await page.locator('#callbackSubmit').click();
 await page.locator('#callbackDone').waitFor({state:'visible'});
 assert.equal(submissions.length,beforeMusandam+1);
 const musandamPayload=submissions.at(-1),musandamDetails=Object.fromEntries(musandamPayload.details);
 assert.equal(musandamPayload.category,'Activities');
 assert.equal(musandamPayload.page,'https://raahhi.com'+musandamPath);
 assert.equal(musandamDetails.Destination,'Musandam, Oman');
 assert.equal(musandamDetails['Option reference'],shared.id);
 await page.locator('#contactModal .modal-close').click();

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
 assert.equal(await page.locator('#callbackCategory').inputValue(),'Packages');await page.locator('#callbackName').fill('Holiday Test');await page.locator('#callbackPhone').fill('+971501234567');
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
 await page.locator('#callbackSubmit').click();await page.locator('#callbackDone').waitFor({state:'visible'});summary=await page.locator('#callbackSummary').textContent();
 for(const value of ['Travellers: 3','Adults: 2','Children: 1','Children ages: 6','Rooms: 2','2027-02-10','2027-02-15','DXB',hotel.label,'Vegetarian <script>example</script>'])assert(summary.includes(value),value+' survives the holiday enquiry');
 assert.equal((summary.match(/Travellers:/g)||[]).length,1,'There is one current group count');
 assert.equal(await page.locator('#callbackSummary script').count(),0,'Free text is not interpreted as markup');
 assert(!summary.includes('USD 531.00'),'The base holiday price does not leak into the selected hotel quote');
 await page.locator('#contactModal .modal-close').click();

 await open('/visas/united-arab-emirates/');
 const entryRoutes=page.getByRole('region',{name:'Check your UAE entry route'});
 assert.equal(await entryRoutes.locator('a[href^="https://u.ae/"]').count(),3);
 await page.locator('.mobile-enquiry-bar button').click();
 const beforeVisa=submissions.length;
 await page.locator('#visaEnqName').fill('Visa Test');await page.locator('#visaEnqEmail').fill('test@example.com');await page.locator('#visaEnqPhone').fill('+971501234567');
 await page.locator('#visaEnqForm button[type="submit"]').click();
 assert(await page.locator('#visaEnqNationalityErr').isVisible()&&await page.locator('#visaEnqResidenceErr').isVisible(),'Nationality and residence are required');
 await page.locator('#visaEnqNationality').selectOption('IN');await page.locator('#visaEnqResidence').selectOption('AE');await page.locator('#visaEnqPurpose').selectOption('business');
 await page.locator('#visaEnqApplicants').fill('3');await page.locator('#visaEnqFlexible').uncheck();
 await page.locator('#visaEnqForm button[type="submit"]').click();assert(await page.locator('#visaEnqDateErr').isVisible());
 await page.locator('#visaEnqDate').fill('2027-03-15');await page.evaluate(()=>setDisplayCurrency('USD'));
 assert.equal(await page.locator('#visaEnqNationality').inputValue(),'IN');
 await page.locator('#visaEnqForm button[type="submit"]').click();await page.locator('#visaEnqDone').waitFor({state:'visible'});summary=await page.locator('#visaEnqSummary').textContent();
 for(const value of ['Nationality: India','Country of residence: United Arab Emirates','Purpose of travel: Business','Applicants: 3','2027'])assert(summary.includes(value),value+' in visa summary');
 assert.equal(submissions.length,beforeVisa+1);
 const visaPayload=submissions.at(-1),visaDetails=Object.fromEntries(visaPayload.details);
 assert.equal(visaPayload.category,'Visas');
 assert.equal(visaPayload.page,'https://raahhi.com/visas/united-arab-emirates/');
 assert.equal(visaDetails.Nationality,'India');
 assert.equal(visaDetails['Country of residence'],'United Arab Emirates');
 assert.match(summary,/Enquiry reference: RH-\d{8}-[0-9A-F]{12}/);
 const visaHandoff=page.locator('#visaEnqDone');
 assert(await visaHandoff.getByRole('link',{name:'Start WhatsApp chat'}).isVisible());
 assert(await visaHandoff.getByRole('link',{name:'Open email enquiry'}).isVisible());
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
