import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await page.goto('file://'+process.cwd()+'/source/raahhi-tours52.html');
 const checks=await page.evaluate(()=>{
  const results=q=>rankEntries(GLOBAL_SEARCH_INDEX,q);
  const has=(q,url)=>results(q).some(r=>r.url===url);
  const all=[...TOURS,...PACKAGES];
  return {
   visa:has('UK visa','/visas/united-kingdom/'),
   plural:has('waterparks','/activities/categories/water-parks/'),
   comparison:results('compare waterparks')[0]?.url==='/compare/uae-water-parks/',
   phrase:has('find dinner cruises in Dubai','/compare/dubai-dinner-cruises/'),
   option:has('SKY','/activities/dubai/burj-khalifa-top/'),
   duration:nightsOf(results('3 nights').find(r=>r.p)?.p)===3,
   exact:results('Sky Views Observatory')[0]?.url==='/activities/dubai/sky-views-observatory/',
   aliases:ACTIVITY_SEARCH_INDEX.every(e=>e.aliases.every(a=>typeof a.norm==='string')),
   links:GLOBAL_SEARCH_INDEX.every(e=>seoRoutes().includes(e.url)),
   related:all.every(t=>{const list=TOURS.includes(t)?relatedActivities(t):relatedPackages(t);return list.length<=3&&new Set(list.map(x=>x.id)).size===list.length&&list.every(x=>x.id!==t.id&&x.dest===t.dest);}),
   decks:relatedActivities(TOURS.find(t=>t.id==='burj-khalifa-top')).slice(0,2).every(t=>['sky-views-observatory','the-view-at-the-palm'].includes(t.id)),
   repeatable:JSON.stringify(relatedActivities(TOURS[0]))===JSON.stringify(relatedActivities(TOURS[0])),
   statusHonesty:statusInfo({status:'unable-to-verify'}).label==='Confirm availability'&&statusInfo({status:'temporarily-closed'}).label==='Check reopening'&&statusOf({})==='unable-to-verify',
   summaryConsistency:!activitySummaryText(TOURS.find(t=>t.id==='evening-desert-safari')).toLowerCase().includes('sandboarding')&&activitySummaryText(TOURS.find(t=>t.id==='evening-desert-safari')).toLowerCase().includes('barbecue'),
   truthfulAvailability:all.every(t=>!availabilityAnswer(t).includes('is available')),

  };
 });
 for(const [name,ok] of Object.entries(checks))assert(ok,name);
 await page.evaluate(()=>{openSearch();setGlobalSearch('Dubai');});
 const group=page.locator('[data-search-group="activity"]');
 assert.equal(await group.locator('a.gs-item').count(),8);
 await group.getByRole('button',{name:/Show .* more activities/}).click();
 assert.equal(await group.locator('a.gs-item').count(),16);
 assert(await page.evaluate(()=>document.activeElement?.classList.contains('gs-item')),'Focus moves to a new result');
 await page.locator('#globalSearch').fill('zzzznotacatalogueitem');
 // fill() fires input; changing the query resets the result limit.
 assert.equal(await page.locator('#globalSearchResults a.gs-item').count(),0);
 await page.locator('#globalSearch').fill('Dubai');
 assert.equal(await group.locator('a.gs-item').count(),8);
 await page.locator('#globalSearch').fill('<img src=x onerror=alert(1)>');
 assert.equal(await page.locator('#globalSearchResults img').count(),0,'Input remains text');
 await page.locator('#globalSearch').press('Escape');
 assert(!(await page.locator('#searchModal').getAttribute('class')).includes('open'));
 await page.goto('file://'+process.cwd()+'/source/raahhi-tours52.html#/activities/dubai');
 await page.locator('#tourSearch').fill('waterparks');
 assert(await page.locator('#tourGrid .product-card').count()>0,'Destination search uses common category spelling');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('PASS catalogue queries, aliases, exact ranking, published links, relevant suggestions, more-results/reset/focus, escaping and destination search');
} finally {await browser.close();}
