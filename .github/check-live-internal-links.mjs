import assert from 'node:assert/strict';
const checks=[
['/activities/dubai/evening-desert-safari/',['/activities/dubai/','/holidays/dubai/','/visas/united-arab-emirates/','/guides/dubai-desert-safari/']],
['/activities/ras-al-khaimah/musandam-dibba-tour/',['/activities/ras-al-khaimah/','/visas/united-arab-emirates/']],
['/holidays/dubai/dubai-grand-stopover/',['/holidays/dubai/','/activities/dubai/','/visas/united-arab-emirates/']],
['/guides/abu-dhabi-theme-parks/',['/activities/abu-dhabi/','/holidays/abu-dhabi/','/visas/united-arab-emirates/']],
['/activities/dubai/',['/guides/dubai-desert-safari/','/guides/dubai-landmarks/','/holidays/dubai/','/visas/united-arab-emirates/']],
['/holidays/abu-dhabi/',['/guides/abu-dhabi-theme-parks/','/activities/abu-dhabi/','/visas/united-arab-emirates/']],
['/visas/united-arab-emirates/',['/activities/dubai/','/activities/abu-dhabi/','/activities/ras-al-khaimah/','/guides/dubai-desert-safari/','/guides/abu-dhabi-theme-parks/']],
['/visas/arrival-essentials/tourist-sim-card-eand/',['/visas/united-arab-emirates/']]
];
for(const [path,links] of checks){
 const response=await fetch('https://raahhi.com'+path,{cache:'no-store'});assert.equal(response.status,200,path);
 const html=await response.text();
 const navs=[...html.matchAll(/<nav\b[^>]*class="[^"]*\bplanning-links\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/g)].map(m=>m[1]).join('');
 assert(navs,path+' planning nav');
 for(const link of links)assert(navs.includes('href="'+link+'"')||html.includes('href="'+link+'"'),path+' -> '+link);
 assert(html.includes('rel="canonical" href="https://raahhi.com'+path+'"'),path+' canonical');
 console.log('PASS live contextual links: '+path);
}
const response=await fetch('https://raahhi.com/build-report.json',{cache:'no-store'});assert.equal(response.status,200);
const report=await response.json();assert.equal(report.planningLinkPages,197);assert.equal(report.planningLinks,633);assert.equal(report.sitemapUrls,245);assert.equal(report.atAGlancePages,228);assert.equal(report.sourcesAndFreshnessPages,228);
console.log('PASS live report: 633 planning links across 197 pages; sitemap 245 URLs');
