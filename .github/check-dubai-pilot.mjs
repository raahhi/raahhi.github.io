import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const slugs=['desert-safaris','cruises','theme-parks','water-parks'];
const routes=['/dubai/',...slugs.map(slug=>'/activities/dubai/categories/'+slug+'/')];
const sitemap=await readFile('dist/sitemap.xml','utf8');
for(const path of routes) assert(sitemap.includes('https://raahhi.com'+path),'Pilot route in sitemap: '+path);
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  try {res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile('dist'+(path.endsWith('/')?path+'index.html':path)));}
  catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try {
  const p=await browser.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const open=async path=>{await p.goto(origin+path);await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);};
  await open('/');assert(await p.locator('main a[href="/dubai/"]').count(),'Homepage discovers the planning hub');
  await open('/dubai/');assert.equal(await p.evaluate(()=>CURRENT.kind),'destinationHub');
  for(const path of ['/activities/dubai/','/holidays/dubai/','/visas/united-arab-emirates/',...routes.slice(1)]) assert(await p.locator('main a[href="'+path+'"]').count(),'Planning hub links to '+path);
  const memberships=[];
  for(const slug of slugs){
    const path='/activities/dubai/categories/'+slug+'/';await open(path);
    const result=await p.evaluate(()=>{
      const items=categoryTours(CURRENT.category);
      const graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
      return {dest:CURRENT.category.dest,name:CURRENT.category.name,expected:items.map(URLS.activity),actual:[...document.querySelectorAll('.category-products tbody th a')].map(a=>a.getAttribute('href')),schema:graph.find(n=>n['@type']==='ItemList').itemListElement.map(n=>n.url),faq:document.querySelector('.page.active h2')?.textContent,onlyDubai:items.every(t=>t.dest==='dubai'),country:URLS.activityCategory(categoryBySlug(CURRENT.category.slug))};
    });
    assert.equal(result.dest,'dubai');assert(result.onlyDubai&&result.expected.length>=4);
    assert.deepEqual(result.actual,result.expected);assert.deepEqual(result.schema,result.expected.map(x=>'https://raahhi.com'+x));
    assert(await p.locator('main a[href="'+result.country+'"]').count(),'City category links to its country category');
    assert.equal(await p.locator('.page.active section.detail-section').filter({has:p.getByRole('heading',{name:'Questions about '+result.name.toLowerCase(),exact:true})}).locator('details').count(),6);
    memberships.push({path,products:result.expected});
    await open(result.country);assert(await p.locator('main a[href="'+path+'"]').count(),'Country category links down to city category');
  }
  for(const {path,products} of memberships){
    for(const product of products){
      await open(product);
      assert.equal(await p.locator('#tourBreadcrumb a[href="'+path+'"]').count(),1,'Product primary category: '+product);
      const trail=await p.evaluate(()=>{
        const graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
        return {visible:[...document.querySelectorAll('#tourBreadcrumb a')].map(a=>'https://raahhi.com'+a.getAttribute('href')),schema:graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.slice(0,-1).map(n=>n.item)};
      });assert.deepEqual(trail.visible,trail.schema,'Visible and structured breadcrumb agree: '+product);
    }
  }
  for(const path of ['/activities/dubai/','/holidays/dubai/','/guides/dubai-first-visit-planning/']){await open(path);assert(await p.locator('main a[href="/dubai/"]').count(),'Existing page links to planner: '+path);}
  await open('/');await p.evaluate(()=>loadActivitySearch());
  assert(await p.evaluate(()=>rankEntries(GLOBAL_SEARCH_INDEX,'Dubai trip planner').some(e=>e.url==='/dubai/')));
  for(const width of [320,390,768,1440]){
    await p.setViewportSize({width,height:900});
    for(const path of routes){await open(path);assert.equal(await p.locator('main h1').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow: '+width+' '+path);}
  }
  // Expected questions need complete authoring records, not the lazy summary catalogue.
  const author=await browser.newPage();
  await author.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await author.goto('file://'+process.cwd()+'/source/raahhi-tours52.html');
  const faqAudit=await author.evaluate(()=>[...TOURS.map(record=>({record,kind:'activity'})),...PACKAGES.map(record=>({record,kind:'holiday'}))].map(({record,kind})=>{
    const selected=focusedProductFaqItems(record,kind),authored=(record.faqs||[]).filter(f=>!/^what else is there to do|^how do i enquire|^how do i book/i.test(stripTags(f.q)));
    return {id:record.id,path:kind==='activity'?URLS.activity(record):URLS.holiday(record),count:selected.length,questions:selected.map(f=>stripTags(f.q)),missingAuthored:record.bookingMode==='official-only'?[]:authored.filter(f=>!selected.some(s=>s.q===f.q)).map(f=>f.q),official:record.bookingMode==='official-only'};
  }));
  for(const row of faqAudit){
    assert(row.count<=8,'Focused FAQ size: '+row.id);
    assert.deepEqual(row.missingAuthored,[],'Keep authored booking answers: '+row.id);
    assert(!row.questions.some(q=>/^what else is there to do|^how do i enquire/i.test(q)),'General browsing and enquiry belong outside product FAQ: '+row.id);
    const html=await readFile('dist'+row.path+'index.html','utf8');
    const count=await author.evaluate(html=>{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const heading=[...doc.querySelectorAll('h2')].find(h=>h.textContent.endsWith(': common questions'));
      return heading ? heading.parentElement.querySelectorAll('.qa-item').length : null;
    },html);
    assert.notEqual(count,null,'Static product FAQ is present: '+row.path);
    assert.equal(count,row.count,'Built HTML matches the focused selection: '+row.id);
    if(row.official) assert.equal(row.count,1,'Official-only product keeps its booking route');
  }
  await author.close();
  await open('/activities/dubai/categories/water-parks/');
  assert(await p.locator('main a[href="/compare/uae-water-parks/"]').count(),'Browse page links to the separate decision comparison');
  const officialRow=p.locator('.category-products tbody tr').filter({has:p.locator('a[href="/activities/dubai/aqua-fun-dubai/"]')});
  assert((await officialRow.textContent()).includes('Check the official booking website'));
  assert(!(await officialRow.textContent()).includes('quote confirmed on enquiry'),'Official-only row does not imply RAAHHI quoting');
  assert.equal(await officialRow.locator('[data-usd-cents]').count(),0,'Operator-only prices are not presented as RAAHHI quotes');
  await open('/compare/uae-water-parks/');
  assert(await p.locator('main a[href="/activities/categories/water-parks/"]').count(),'Comparison retains country browsing connection');
  await open('/faq/');assert(await p.getByText('Does a listing status confirm availability for my date?',{exact:true}).count());
  await open('/activities/categories/theme-parks/');
  assert.equal(await p.getByText('Does every listing include the same things?',{exact:true}).count(),0,'Country categories do not repeat company-wide FAQs');
  assert(await p.locator('main a[href="/faq/"]').count(),'Shared questions link to their owner');
  assert(await p.locator('main a[href="/activities/dubai/categories/theme-parks/"]').count(),'Country category links to Dubai browsing');
  await open('/compare/uae-water-parks/');
  assert(await p.locator('main a[href="/activities/dubai/categories/water-parks/"]').count(),'Comparison links directly to Dubai browsing');
  assert.deepEqual(errors,[]);
  console.log('PASS four Dubai city categories, complete mapped membership, reciprocal links, primary breadcrumbs, search, four responsive widths and '+faqAudit.length+' focused static product FAQ blocks');
} finally {await browser.close();server.close();}
