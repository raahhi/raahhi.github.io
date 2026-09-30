import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const baseline = execFileSync('git', ['show','48b4a971f96cadbf16521a8e8e504226db255bce:source/raahhi-tours52.html'], {maxBuffer:4*1024*1024}).toString();
const source = await readFile('source/raahhi-tours52.html','utf8');
const server = createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/html');
  if(path === '/baseline/source.html') return res.end(baseline);
  if(path === '/current/source.html') return res.end(source);
  try {res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
  catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
async function page(options={}){const p=await browser.newPage(options);await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());return p;}
try{
  const probe=await page();await probe.goto(base+'/current/source.html#home');
  const expectations=await probe.evaluate(()=>{
    const visa=URLS.visa(visaBySlug('united-arab-emirates'));
    const result=[];
    function add(path,dest,guides){
      const links=[];
      if(TOURS.some(t=>t.dest===dest))links.push(URLS.activityDest(dest));
      if(PACKAGES.some(p=>p.dest===dest))links.push(URLS.holidayDest(dest));
      links.push(visa,...guides.map(g=>URLS.guide(g.slug)));
      result.push({path,links:[...new Set(links)].filter(x=>x!==path)});
    }
    TOURS.forEach(t=>add(URLS.activity(t),t.dest,GUIDES.filter(g=>g.ids().includes(t.id))));
    VISA_ADDONS.forEach(t=>add(URLS.addon(t),t.dest,GUIDES.filter(g=>g.ids().includes(t.id))));
    PACKAGES.forEach(p=>{
      const ids=itineraryActivities(p).map(x=>x.t.id);
      add(URLS.holiday(p),p.dest,GUIDES.filter(g=>g.ids().some(id=>ids.includes(id))));
    });
    DESTINATIONS.forEach(d=>{
      add(URLS.activityDest(d.slug),d.slug,GUIDES.filter(g=>g.dest===d.slug));
      const packages=PACKAGES.filter(p=>p.dest===d.slug);
      const ids=packages.flatMap(p=>itineraryActivities(p).map(x=>x.t.id));
      add(URLS.holidayDest(d.slug),d.slug,GUIDES.filter(g=>g.dest===d.slug||g.ids().some(id=>ids.includes(id))));
    });
    GUIDES.forEach(g=>add(URLS.guide(g.slug),g.dest,GUIDES.filter(x=>x.dest===g.dest)));
    result.push({path:visa,links:DESTINATIONS.flatMap(d=>[
      ...(TOURS.some(t=>t.dest===d.slug)?[URLS.activityDest(d.slug)]:[]),
      ...(PACKAGES.some(p=>p.dest===d.slug)?[URLS.holidayDest(d.slug)]:[])
    ]).concat(GUIDES.map(g=>URLS.guide(g.slug)))});
    return {routes:seoRoutes(),result,guidePairs:GUIDES.flatMap(g=>g.ids().map(id=>[URLS.guide(g.slug),URLS.activity(TOURS.find(t=>t.id===id))])),
      itineraryPairs:PACKAGES.flatMap(p=>itineraryActivities(p).map(x=>[URLS.holiday(p),URLS.activity(x.t)]))};
  });
  const generated={};
  for(const route of expectations.routes)generated[route]=await readFile('dist'+(route==='/'?'/index.html':route+'index.html'),'utf8');
  await probe.evaluate(({generated,expectations})=>{
    const docs=Object.fromEntries(Object.entries(generated).map(([r,h])=>[r,new DOMParser().parseFromString(h,'text/html')]));
    for(const {path,links} of expectations.result){
      const navs=[...docs[path].querySelectorAll('.page.active .planning-links')];
      const actual=navs.flatMap(n=>[...n.querySelectorAll('a')].map(a=>a.getAttribute('href')));
      for(const link of links)if(!actual.includes(link))throw Error('Missing planning edge '+path+' -> '+link);
    }
    for(const [a,b] of [...expectations.guidePairs,...expectations.itineraryPairs]){
      for(const [from,to] of [[a,b],[b,a]])
        if(!docs[from].querySelector('.page.active a[href="'+to+'"]'))throw Error('Missing reciprocal edge '+from+' -> '+to);
    }
  },{generated,expectations});
  console.log('PASS all contextual links, guide/activity reciprocity, package/activity reciprocity');
  await probe.close();
  const samples=['/activities/dubai/evening-desert-safari/','/activities/ras-al-khaimah/jebel-jais-flight/','/holidays/dubai/dubai-grand-stopover/','/guides/abu-dhabi-theme-parks/','/activities/dubai/','/holidays/abu-dhabi/','/visas/united-arab-emirates/','/visas/arrival-essentials/tourist-sim-card-eand/'];
  // Use actual manifest paths for destinations whose catalogue ID might differ.
  samples[1]=expectations.routes.find(r=>/^\/activities\/ras-al-khaimah\/[^/]+\/$/.test(r));
  for(const route of samples){
    assert(route);
    const old=await page();await old.goto(base+'/baseline/source.html#'+route.replace(/^\/+|\/+$/g,''));
    const oldFacts=await old.locator('.page.active .at-a-glance').count()?await old.locator('.page.active .at-a-glance').innerText():null;
    await old.close();
    for(const width of [390,1440]){
      const p=await page({javaScriptEnabled:false,viewport:{width,height:900}});await p.goto(base+route);
      const navs=p.locator('.page.active .planning-links');assert(await navs.count()>0,route);
      for(const nav of await navs.all()){
        assert(await nav.isVisible(),route+' nav visible');
        const box=await nav.boundingBox();assert(box.x>=0&&box.x+box.width<=width,route+' nav fits');
        assert(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth),route+' no nav overflow');
      }
      if(oldFacts)assert.equal(await p.locator('.page.active .at-a-glance').innerText(),oldFacts,route+' facts preserved');
      await p.close();
    }
    const hydrated=await page();await hydrated.goto(base+route);await hydrated.waitForFunction(()=>typeof planningLinksHTML==='function');
    assert(await hydrated.locator('.page.active .planning-links').count()>0);
    await hydrated.close();
    console.log('PASS static/mobile/desktop/hydration and preserved facts: '+route);
  }
  const report=JSON.parse(await readFile('dist/build-report.json','utf8'));
  assert.equal(report.sitemapUrls,245);assert.equal(report.atAGlancePages,228);assert.equal(report.sourcesAndFreshnessPages,228);
  assert(report.planningLinkPages>190);assert(report.planningLinks>500);
  console.log('PASS build report '+JSON.stringify(report));
}finally{await browser.close();server.close();}
