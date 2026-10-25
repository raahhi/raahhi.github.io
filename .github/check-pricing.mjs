import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import assert from 'node:assert/strict';
import {validateRates,updateRates} from '../scripts/update-exchange-rates.mjs';
const source=await readFile('source/raahhi-tours52.html','utf8');
const catalogue=JSON.parse(source.match(/^const PRICE_CATALOGUE = (.*);$/m)[1]);
const rates=JSON.parse(source.match(/^const FX_RATES = (.*);$/m)[1]);
assert.equal(Object.keys(catalogue).length,235);
assert.equal(Object.values(catalogue).filter(p=>p.amount!==null).length,234);
for(const p of Object.values(catalogue))if(p.amount!==null)assert.equal(Math.round(p.sourceAmount*100)-Math.round(p.amount*100),200);
const valid={result:'success',base_code:'USD',rates:rates.rates,time_last_update_unix:Math.floor(Date.now()/1000)};
validateRates(valid);assert.throws(()=>validateRates({...valid,rates:{...rates.rates,INR:0}}));assert.throws(()=>validateRates({...valid,time_last_update_unix:1}));
const temp=await mkdtemp(join(tmpdir(),'raahhi-fx-'));
try{
 const path=join(temp,'source.html');await writeFile(path,source);
 await updateRates({path,fetcher:async()=>{throw Error('Test offline');}});
 assert.equal(await readFile(path,'utf8'),source,'Offline provider keeps exact saved cache');
 await updateRates({path,fetcher:async()=>({ok:true,json:async()=>({...valid,rates:{USD:1}})})});
 assert.equal(await readFile(path,'utf8'),source,'Incomplete provider response cannot overwrite cache');
}finally{await rm(temp,{recursive:true,force:true});}
const server=createServer(async(req,res)=>{const p=new URL(req.url,'http://local').pathname;try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.webp')?'image/webp':p.endsWith('.png')?'image/png':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(await readFile('dist'+(p.endsWith('/')?p+'index.html':p)));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:900}});const p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await p.goto(base+'/activities/dubai/evening-desert-safari/');
 const select=p.locator('[data-currency-select]');await select.waitFor();await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
 assert.equal(await select.locator('option').count(),18);assert.equal(await select.inputValue(),'AED');
 assert(await p.locator('.page.active [data-usd-cents="2665"]').count()>=3,'Cards, detail facts, FAQ and mobile bar expose convertible amounts');
 for(const code of ['INR','USD','JPY','BHD','AED']){
  await select.selectOption(code);
  const actual=await p.locator('.page.active [data-usd-cents="2665"]').allTextContents();
  const digits=new Intl.NumberFormat('en',{style:'currency',currency:code}).resolvedOptions().maximumFractionDigits;
  const expected=code+' '+new Intl.NumberFormat('en',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(26.65*rates.rates[code]);
  assert(actual.length&&actual.every(v=>v===expected),code+' updates every price location from the unrounded USD amount');
 }
 await p.locator('#tourEnqGuests').fill('4');await p.evaluate(()=>enquireAboutProduct('activity','evening-desert-safari'));
 await p.locator('#callbackName').fill('Test Traveller');await p.locator('#callbackPhone').fill('+971501234567');
 await p.locator('#callbackOptional summary').click();await p.locator('#callbackNotes').fill('Budget USD 200.00 <script>test</script>');
 await p.evaluate(()=>setDisplayCurrency('INR'));
 assert.equal(await p.locator('#tourEnqGuests').inputValue(),'4');assert.equal(await p.locator('#callbackName').inputValue(),'Test Traveller');
 await p.locator('#callbackSubmit').click();assert((await p.locator('#callbackSummary').textContent()).includes('INR'));
 assert((await p.locator('#callbackSummary').textContent()).includes('Budget USD 200.00 <script>test</script>'));
 assert.equal(await p.locator('#callbackSummary script').count(),0,'User input remains text');
 for(const route of ['/holidays/dubai/dubai-grand-stopover/','/visas/united-arab-emirates/','/activities/categories/water-parks/','/compare/uae-water-parks/','/activities/dubai/','/visas/']){
  await p.goto(base+route);await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
  assert.equal(await select.inputValue(),'INR','Currency persists across full-page navigation');
  const amounts=await p.locator('[data-usd-cents]').allTextContents();assert(amounts.length&&amounts.every(v=>v.startsWith('INR ')),route+' currency parity');
 }
 await p.goto(base+'/activities/dubai/overnight-desert-safari/');
 assert((await p.locator('.page.active .bb-price').textContent()).includes('Reference from'));
 assert(!(await p.locator('body').textContent()).includes('Supplier currently unavailable'));
 assert((await p.locator('.page.active .bb-price').textContent()).includes('final quote confirmed on enquiry'));
 const offers=await p.evaluate(()=>JSON.stringify(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)));
 assert(!offers.includes('"price":132.78'),'Unavailable reference has no bookable Offer');
 await p.goto(base+'/holidays/dubai/dubai-easter-short-break/');assert((await p.locator('.page.active .bb-price').textContent()).includes('confirmed on enquiry'));
 await p.goto(base+'/');await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);
 await p.evaluate(()=>{openSearch();setGlobalSearch('Evening Desert Safari');});await p.waitForFunction(()=>window.RAAHHI_CATALOGUE.searchReady);
 assert((await p.locator('#globalSearchResults').textContent()).includes('INR'));
 await p.evaluate(()=>closeModal('searchModal'));
 for(const width of [320,360,390,768,1024,1440]){
  await p.setViewportSize({width,height:900});
  assert(await select.isVisible(),'Currency control visible at '+width);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No horizontal overflow at '+width);
 }
 await context.clearCookies();await p.evaluate(()=>localStorage.setItem('raahhi.currency','BAD'));await p.reload();await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);assert.equal(await select.inputValue(),'AED','Invalid saved preference falls back safely');
 await p.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Blocked storage')};Storage.prototype.setItem=()=>{throw Error('Blocked storage')};});
 await p.reload();await p.waitForFunction(()=>!document.querySelector('[data-currency-select]').disabled);await select.selectOption('USD');assert.equal(await select.inputValue(),'USD');
 assert.deepEqual(errors,[]);
 await p.setViewportSize({width:390,height:900});await p.goto(base+'/activities/dubai/evening-desert-safari/');if(process.env.RAAHHI_QA_SCREENSHOT)await p.screenshot({path:process.env.RAAHHI_QA_SCREENSHOT});
 console.log('PASS 235-product coverage; exact USD discounts; 18 currencies; persistence, precision, reference/unknown prices, enquiries, search, responsive controls, offline rate fallback and blocked storage');
}finally{await browser.close();server.close();}
