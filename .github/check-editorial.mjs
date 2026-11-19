import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const registry=JSON.parse(await readFile('source/published-urls.json','utf8'));
const editorialKinds=new Set(['guide','guides','category','comparison','destinationHub','countryHub','attraction']);
const productKinds=new Set(['activity','holiday','visa','addon']);
const counts={pages:0,editorial:0,products:0,articlesWithRecordedContentDates:0,articlesWithoutRecordedContentDates:0,listingCheckDateNotRecorded:0};
for(const item of registry.pages){
 const html=await readFile('dist'+item.path+'index.html','utf8');counts.pages++;
 const has=word=>html.includes(word);
 if(editorialKinds.has(item.kind)){
  counts.editorial++;assert.equal((html.match(/class="editorial-responsibility"/g)||[]).length,1,'One visible accountability block '+item.path);
  assert(has('Raahi Tourism PVT LTD')&&has('Report a correction')&&has('href="/about/#editorial-standards"'),item.path);
 }
 if(productKinds.has(item.kind)){
  counts.products++;assert(has('sources-and-freshness')&&has('editorial-owner')&&has('freshness-summary'),'Product source scope and responsibility '+item.path);
  if(has('check date not recorded'))counts.listingCheckDateNotRecorded++;
 }
 if(item.kind==='guide'){
  const graph=JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)[1])['@graph'];
  const article=graph.find(n=>n['@type']==='Article'),org=graph.find(n=>n['@type']==='Organization');assert(!html.includes('Planning guidance reviewed <time'), 'No inherited generic byline review date '+item.path);
  assert.deepEqual(article.author,{'@id':org['@id']},'Retain truthful organisation author');
  if(article.datePublished||article.dateModified){counts.articlesWithRecordedContentDates++;for(const date of [article.datePublished,article.dateModified].filter(Boolean))assert(has('datetime="'+date+'"'),'Visible/schema date parity '+item.path);}
  else counts.articlesWithoutRecordedContentDates++;
  assert((html.match(/<h2(?:\s|>)/g)||[]).length>=3&&has('planning-links'),'Useful guide and onward planning '+item.path);
 }
 if(item.kind==='holiday'){
  assert(/<h2[^>]*>[^<]*[Ii]tinerary/.test(html),'Package itinerary '+item.path);
  assert(has('Accommodation</dt>')&&has('Meals</dt>'),'Show known or explicitly unrecorded stay/meal basis '+item.path);
 }
 if(item.kind==='category')assert(has('category-products')&&has('Choosing an experience'),'Category choice and full membership '+item.path);
 if(item.kind==='comparison')assert(has('comparison-table'),'Comparison members '+item.path);
 if(item.kind==='attraction')assert(has('attraction-products'),'Separate bookable choices '+item.path);
 if(['countryHub','destinationHub'].includes(item.kind))assert(has('planning-links')&&has('qa-item'),'Planning connections and scoped questions '+item.path);
}
assert.equal(counts.pages,287);assert.equal(counts.products,235);assert.equal(counts.articlesWithRecordedContentDates+counts.articlesWithoutRecordedContentDates,6);
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path==='/preview.html'?'source/raahhi-tours52.html':'dist'+(path.endsWith('/')?path+'index.html':path)));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
 const staticContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
 await staticContext.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const staticPage=await staticContext.newPage();
 const questions=[
  'How much does my visa cost?',
  'Which documents will I need?',
  'What if my visa takes longer than expected?',
  'Do I need to visit an embassy or consulate?',
  'Can I track my application?',
  'What happens if my visa is rejected?'
 ];
 await staticPage.goto(origin+'/faq/');
 const faqGraph=JSON.parse(await staticPage.locator('script[type="application/ld+json"]').textContent())['@graph'];
 const faqNode=faqGraph.find(node=>node['@type']==='FAQPage');
 const normalize=value=>value.replace(/\s+/g,' ').trim();
 const visiblePairs=await staticPage.locator('main .qa-item').evaluateAll(items=>items.map(item=>[
  item.querySelector('summary').textContent,item.querySelector('.qa-answer').textContent
 ]));
 const schemaPairs=faqNode.mainEntity.map(({name,acceptedAnswer})=>[name,acceptedAnswer.text]);
 assert.equal(visiblePairs.length,14);
 assert.deepEqual(visiblePairs.map(pair=>pair.map(normalize)),schemaPairs.map(pair=>pair.map(normalize)),'Company FAQ markup matches visible questions and answers');
 assert(visiblePairs.some(([question])=>question==='Is a UAE visa included in RAAHHI TOURS holiday packages?'));
 assert(questions.every(q=>!visiblePairs.some(([question])=>question===q)),'Visa process questions are owned by the visa gateway');
 await staticPage.getByRole('link',{name:'visa assistance questions',exact:true}).click();
 assert.equal(staticPage.url(),origin+'/visas/#visa-questions');
 assert.equal(await staticPage.locator('#visa-questions').count(),1);
 assert.deepEqual(await staticPage.locator('#visaFaq summary').allTextContents(),questions);
 await staticPage.getByText(questions[0],{exact:true}).click();
 assert(await staticPage.locator('#visaFaq details[open] .qa-answer').isVisible(),'Native disclosure opens without JavaScript');
 assert(await staticPage.locator('main a[href="/visas/united-arab-emirates/"]').count(),'Visa catalogue still links to destination enquiries');
 const guidesPath='/guides/',plannerPaths=['/united-arab-emirates/','/dubai/','/abu-dhabi/','/ras-al-khaimah/'];
 const guidePaths=registry.pages.filter(item=>item.kind==='guide').map(item=>item.path).sort();
 for(const path of plannerPaths){
  await staticPage.goto(origin+path);
  assert.equal(await staticPage.locator('main a[href="/guides/"]').count(),1,'Planner links to the guide index '+path);
 }
 await staticPage.locator('main a[href="/guides/"]').click();
 assert.equal(staticPage.url(),origin+guidesPath);
 assert.equal(await staticPage.getByRole('heading',{level:1}).textContent(),'UAE travel guides');
 const guideLinks=await staticPage.locator('main .guide-card h3 a').evaluateAll(anchors=>anchors.map(a=>[a.getAttribute('href'),a.textContent]));
 assert.deepEqual(guideLinks.map(([path])=>path).sort(),guidePaths,'Every guide is linked once');
 const guideGraph=JSON.parse(await staticPage.locator('script[type="application/ld+json"]').textContent())['@graph'];
 const guidePage=guideGraph.find(node=>node['@type']==='CollectionPage');
 const guideList=guideGraph.find(node=>node['@id']===guidePage.mainEntity['@id']);
 assert.equal(guideList.numberOfItems,guidePaths.length);
 assert.deepEqual(guideList.itemListElement.map(item=>[new URL(item.url).pathname,item.name]),guideLinks,'Index schema matches visible guide order and names');
 const onward=await staticPage.locator('main .planning-links a').evaluateAll(anchors=>anchors.map(a=>a.getAttribute('href')));
 assert.deepEqual(onward,plannerPaths);
 await staticPage.locator('main .guide-card h3 a').first().click();
 assert.equal(staticPage.url(),origin+guideLinks[0][0]);
 assert.equal(await staticPage.locator('main a[href="/guides/"]').count(),1);
 assert((await readFile('dist/llms.txt','utf8')).includes('(https://raahhi.com/guides/)'));
 const scopedVisas={
  armenia:{route:/Visitor eVisa/,processing:/Up to 3 working days/,stay:/21 or 120 days/,stale:/3–7 working days/},
  australia:{route:/Visitor visa \(600\), ETA \(601\) or eVisitor \(651\)/,processing:/varies by route/i,stale:/Sticker/},
  azerbaijan:{route:/Single-entry ASAN eVisa/,processing:/Within 3 working days/,validity:/^90 days$/,stay:/^Up to 30 days$/,stale:/30 days typical|3–5 working days/},
  bahrain:{route:/Visit eVisa/,processing:/Varies by the applicable visa category/,stale:/1–4 working days/},
  china:{route:/Mainland China tourist visa \(L\)/,processing:/Applications in India: 7 working days regular or 4 working days express, counted from the day after passport submission/,stale:/Sticker visa|4–10 working days/},
  egypt:{route:/Single- or multiple-entry tourism eVisa/,leadTime:/at least 7 days before departure/,stay:/As specified on the visa/,stale:/2–7 working days|up to 90 days/},
  ethiopia:{route:/Single-entry tourist eVisa/,processing:/3 days under normal circumstances/,validity:/Starts on the intended date of entry/,stay:/30 or 90 days/,stale:/3–7 working days|30\/90 days/},
  georgia:{route:/Short-stay eVisa/,processing:/At least 5 working days/,stay:/As specified on the visa/,stale:/30 days typical|3–7 working days/},
  ghana:{route:/Visitor eVisa/,processing:/96 hours for standard eVisa processing/,validity:/90 days to enter/,stay:/Up to 60 days, as determined at the border/,stale:/4 business days/},
  'hong-kong':{route:/Pre-arrival registration for eligible Indian nationals/,processing:/results are immediate.*four weeks after all required documents/,validity:/Six months for successful pre-arrival registration/,stay:/Up to 14 days per visit/,freeRegistration:true,stale:/Pre-arrival \/ Visa/},
  india:{route:/30 days, one year or five years/,leadTime:/at least 4 days before arrival/,stay:/180 days in total per calendar year/,stale:/30\/90\/365 days|72–96 hours/},
  indonesia:{route:/B1.*C1 single-entry/,processing:/four working days for C1 after payment/,validity:/90 days to enter from issuance for electronic B1 and C1/,stay:/30 days on B1 or up to 60 days on C1/,stale:/1–5 working days/},
  ireland:{route:/Short-stay C tourist visa/,processing:/Varies by visa office/,validity:/Entry window as issued/,stay:/Up to 90 days.*determined at the border/,stale:/Sticker \(Type C\)|7–10 working days/},
  japan:{route:/Single-entry short-term tourism eVisa/,processing:/five working days from the day after/,validity:/Three months for a single-entry visa/,stay:/Up to 90 days/,stale:/eVisa \/ Sticker|5–10 working days/},
  kenya:{route:/Electronic Travel Authorisation/,processing:/Typically three working days/,validity:/90 days to travel from issuance/,stay:/Determined at entry/,stale:/2–5 working days/},
  kuwait:{route:/Single-entry tourist visa/,processing:/issuing authority/,validity:/30 days to enter from issuance/,stay:/Up to 90 days from entry/,stale:/3–10 working days|eVisa \/ Sticker/},
  lebanon:{route:/Visit visa route depends/,leadTime:/embassy applications at least one month/,stay:/As specified on the visa/,stale:/5–12 working days/},
  malaysia:{route:/Social visit eVisa where required/,processing:/2–7 working days after payment and complete eVisa submission/,waiver:/up to 30 days for eligible Indian nationals through 31 December 2026/,stale:/3–7 working days/},
  morocco:{route:/Single-entry eVisa/,processing:/72 hours counted on Moroccan working days/,validity:/Up to 180 days from issuance/,stay:/Up to 30 days/,stale:/3–7 working days|eVisa \/ Exemption/},
  'new-zealand':{route:/Visitor Visa where required or NZeTA/,processing:/Allow 72 hours for an NZeTA.*weekly wait times/,validity:/NZeTA usually valid for two years/,stay:/Visa-waiver visits are usually up to three months/,stale:/NZeTA \/ Visa/},
  oman:{route:/Tourist eVisa where required/,leadTime:/recommends applying at least four days ahead/,waiver:/visa-free for up to 14 days/,stale:/1–5 working days/},
  philippines:{route:/Temporary visitor visa or eVisa/,processing:/7–12 working days for a single-entry eVisa and 15–21 working days/,stay:/applicable visa-free route/,waiver:/up to 14 days, or up to 30 days with a qualifying visa or residence permit/,stale:/59 days\/visit|7–21 working days/},
  russia:{route:/Unified single-entry eVisa/,processing:/Four calendar days.*excluding the submission day/,validity:/Up to 120 days from issuance/,stay:/Up to 30 days from entry/,stale:/eVisa \/ Sticker|4–12 working days/},
  'south-africa':{route:/Visitor visa where required or Electronic Travel Authorisation/,processing:/visa or ETA application channel/,stay:/up to 90 days; check ETA conditions separately/,stale:/Sticker visa|5–15 working days/},
  'south-korea':{route:/Short-term tourist visa for ordinary Indian passports.*K-ETA for eligible visa-free travellers/,processing:/Korean mission or visa application centre/,stale:/K-ETA \/ Sticker|1–7 working days/},
  'sri-lanka':{route:/Tourist ETA before arrival.*ordinary Indian passport holders/,processing:/application status through the official ETA portal/,stay:/two entries within 30 days from first arrival/,freeETA:/pay no government fee for the tourist ETA/,stale:/Minutes to 24 hours|30 days, double entry/},
  tanzania:{route:/Ordinary single-entry eVisa/,validity:/Up to 90 days for the ordinary single-entry visa/,leadTime:/Apply ten days before travel, or two months ahead/,processing:/within ten days for online applications outside the referral visa category/,stale:/90 days typical|3–7 working days/},
  turkey:{route:/Conditional single-entry eVisa or Turkish mission visa/,validity:/One month for the qualifying eVisa/,leadTime:/at least 48 hours before departure/,eligibility:/qualifying valid visa or residence permit from a Schengen member, the US, the UK or Ireland/,stale:/eVisa \/ Sticker|1–3 days/},
  uganda:{route:/Online single-entry tourist visa/,validity:/Travel within 90 days from visa approval/,stay:/Up to three months/,processing:/current timing with the official Uganda visa portal/,stale:/3–7 working days/},
  uzbekistan:{route:/Tourist eVisa where eligible and required/,validity:/90 days from eVisa issuance/,stay:/Up to 30 days on the eVisa, within its validity/,leadTime:/at least three working days before arrival/,processing:/two working days for eVisa consideration, excluding the submission day/,waiver:/1 September 2026.*multiple-entry business or tourist visa.*air ticket to India or a third country/,stale:/2–5 working days/},
  vietnam:{route:/Single- or multiple-entry eVisa/,validity:/Up to 90 days, with dates and entry count as issued/,processing:/three working days for a complete, paid eVisa application/,stale:/3–5 working days/},
  brazil:{route:/depends on passport and consular jurisdiction/,processing:/Varies by consular post/,stale:/5–10 working days|eVisa \/ Exemption/}
 };
 for(const [country,expected] of Object.entries(scopedVisas)){
  const path='/visas/'+country+'/';
  await staticPage.goto(origin+path);
  const summary=await staticPage.locator('.at-a-glance .key-facts div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[
   row.querySelector('dt').textContent,row.querySelector('dd').textContent
  ])));
  assert.match(summary['Visa route'],expected.route,path);
  const timingLabel=expected.leadTime?'Application lead time':'Processing guidance';
  assert.match(summary[timingLabel],expected.leadTime||expected.processing,path);
  if(expected.leadTime)assert(!Object.hasOwn(summary,'Processing guidance'),path+' lead time is distinct from processing');
  if(expected.validity)assert.match(summary.Validity,expected.validity,path);
  if(expected.stay)assert.match(summary['Permitted stay'],expected.stay,path);
  const answers=await staticPage.locator('#visaDetailFaq .qa-answer').allTextContents();
  assert(answers.some(answer=>answer.includes(summary['Visa route'])),path+' route in FAQ');
  assert(answers.some(answer=>answer.includes(summary[timingLabel])),path+' timing in FAQ');
  if(expected.stay)assert(answers.some(answer=>answer.includes(summary['Permitted stay'])),path+' stay in FAQ');
  if(expected.leadTime&&expected.processing){
   const note=await staticPage.locator('.at-a-glance-note').textContent();
   assert.match(note,expected.processing,path+' processing alongside labelled lead time');
   assert(answers.some(answer=>expected.processing.test(answer)),path+' processing in FAQ');
  }
  if(expected.eligibility){
   assert.match(await staticPage.locator('.at-a-glance-note').textContent(),expected.eligibility,path);
   assert(answers.some(answer=>expected.eligibility.test(answer)),path+' eligibility in FAQ');
  }
  if(expected.freeETA){
   assert.match(summary['RAAHHI quote'],expected.freeETA,path);
   assert.match(await staticPage.locator('#visaBookingBox .bb-price').textContent(),expected.freeETA,path);
   assert.match(await staticPage.locator('.mobile-enquiry-summary .price-basis').textContent(),/RAAHHI quote.*Official ETA free for eligible travellers/,path);
   assert(answers.some(answer=>expected.freeETA.test(answer)&&answer.includes('RAAHHI starting quote')),path+' separates the free ETA and assistance quote');
  }
  if(expected.waiver){
   assert.match(summary['Entry waiver'],expected.waiver);
   assert(answers.some(answer=>answer.includes(summary['Entry waiver'])),path+' waiver in FAQ');
   assert.match(await staticPage.locator('#visaBookingBox .form-note').first().textContent(),expected.waiver);
  }
  if(expected.freeRegistration){
   assert.match(summary['RAAHHI quote'],/Official pre-arrival registration is free/i);
   assert.match(await staticPage.locator('#visaBookingBox .bb-price').textContent(),/RAAHHI quote.*Official pre-arrival registration is free/i);
   assert(answers.some(answer=>/Official pre-arrival registration is free.*RAAHHI starting quote/i.test(answer)),path+' distinguishes the free official registration from the commercial quote');
  }
  const review=staticPage.locator('.sources-and-freshness');
  const sources=await review.locator('.source-list a').evaluateAll(anchors=>anchors.map(a=>a.href));
  const dates=await review.locator('.source-list time').evaluateAll(times=>times.map(time=>time.dateTime));
  assert(sources.length>0&&sources.length===dates.length&&dates.every(date=>date==='2026-11-19'),path+' review is scoped to individual sources');
  const graph=JSON.parse(await staticPage.locator('script[type="application/ld+json"]').textContent())['@graph'];
  const pageNode=graph.find(node=>node.url==='https://raahhi.com'+path);
  assert.deepEqual(pageNode.citation,sources,path+' structured sources match visible links');
  assert(!Object.hasOwn(pageNode,'dateModified'),path+' fact check is not a page update date');
  assert(!expected.stale.test(await staticPage.locator('main').textContent()),path+' stale visible claims removed');
  assert(!expected.stale.test(JSON.stringify(graph)),path+' stale structured claims removed');
 }
 await staticContext.close();
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await p.goto(origin+'/preview.html#/faq');
 await p.locator('#page-faq.active').waitFor();
 await p.getByRole('link',{name:'visa assistance questions',exact:true}).click();
 await p.locator('#page-visas.active #visa-questions').waitFor();
 assert.equal(p.url(),origin+'/preview.html#/visas#visa-questions');
 await p.goto(origin+'/#/visas#visa-questions');
 await p.waitForURL(origin+'/visas/#visa-questions');
 await p.goto(origin+'/guides/choose-a-uae-emirate/');await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
 await p.evaluate(()=>{openSearch();setGlobalSearch('UAE travel guides');});
 await p.locator('#globalSearchResults a[href="/guides/"]').waitFor();
 await p.locator('#globalSearch').press('Escape');
 const dates=await p.evaluate(()=>({reviewOnly:editorialArticleDates({reviewedOn:'2026-11-17'}),recorded:editorialArticleDates({publishedOn:'2026-11-16',contentUpdatedOn:'2026-11-17'}),invalid:editorialArticleDates({publishedOn:'2026-02-30',contentUpdatedOn:'2099-01-01'})}));
 assert.deepEqual(dates.reviewOnly,{});assert.deepEqual(dates.recorded,{datePublished:'2026-11-16',dateModified:'2026-11-17'});assert.deepEqual(dates.invalid,{});
 await p.evaluate(()=>{applySeo();applySeo();});assert.equal(await p.locator('main .editorial-responsibility').count(),1,'No duplicate ownership after metadata refresh');
 assert((await p.locator('main .editorial-responsibility').textContent()).includes('17 November 2026'));
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});for(const path of ['/guides/','/guides/dubai-desert-safari/','/guides/choose-a-uae-emirate/','/holidays/dubai/dubai-grand-stopover/','/about/']){await p.goto(origin+path);await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width+' '+path);}}
 assert.deepEqual(errors,[]);console.log('PASS page-type completeness, truthful organisation responsibility, separate review/content/source dates, omitted unknown article dates, correction path, explicit package gaps and responsive presentation '+JSON.stringify(counts));
}finally{await browser.close();server.close();}
