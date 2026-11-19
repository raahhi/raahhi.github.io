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
  brazil:{route:/depends on passport and consular jurisdiction/,processing:/Varies by consular post/,stale:/5–10 working days|eVisa \/ Exemption/}
 };
 for(const [country,expected] of Object.entries(scopedVisas)){
  const path='/visas/'+country+'/';
  await staticPage.goto(origin+path);
  const summary=await staticPage.locator('.at-a-glance .key-facts div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[
   row.querySelector('dt').textContent,row.querySelector('dd').textContent
  ])));
  assert.match(summary['Visa route'],expected.route,path);
  assert.match(summary['Processing guidance'],expected.processing,path);
  if(expected.validity)assert.match(summary.Validity,expected.validity,path);
  if(expected.stay)assert.match(summary['Permitted stay'],expected.stay,path);
  const answers=await staticPage.locator('#visaDetailFaq .qa-answer').allTextContents();
  assert(answers.some(answer=>answer.includes(summary['Visa route'])),path+' route in FAQ');
  assert(answers.some(answer=>answer.includes(summary['Processing guidance'])),path+' timing in FAQ');
  if(expected.stay)assert(answers.some(answer=>answer.includes(summary['Permitted stay'])),path+' stay in FAQ');
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
