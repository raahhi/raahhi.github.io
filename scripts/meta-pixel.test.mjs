import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./meta-pixel.js',import.meta.url),'utf8');
function setup({choice=null,gpc=false,dnt='',search='',storageFails=false}={}){
  const storage=new Map(choice?[['raahhi.ads.choice.v1',JSON.stringify(choice)]]:[]),scripts=[],events={};
  const ctx={navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},location:{search},Date,URLSearchParams,Set,
    localStorage:{getItem:k=>{if(storageFails)throw Error('denied');return storage.get(k)||null;},setItem:(k,v)=>{if(storageFails)throw Error('denied');storage.set(k,v);}},
    document:{createElement:()=>({}),head:{append:s=>scripts.push(s)}},window:{addEventListener:(n,f)=>events[n]=f}};
  vm.runInNewContext(source,ctx);return {api:ctx.window.raahhiMeta,ctx,scripts,storage,events,calls:()=>Array.from(ctx.window.fbq?.queue||[],a=>Array.from(a))};
}
test('no Meta script or events before separate advertising consent, including stale and invalid choices',()=>{
  for(const choice of [null,{value:'decline',at:Date.now()},{value:'allow',at:Date.now()-181*86400000},{value:'allow',at:Date.now()+60000},{value:'allow',at:'invalid'}]){
    const x=setup({choice});x.api.lead('RH-20261124-ABCDEF123456');assert.equal(x.scripts.length,0);assert.equal(x.calls().length,0);
  }
});
test('explicit consent loads one script, disables automatic configuration and sends one PageView',()=>{
  const x=setup();x.api.setConsent(true);x.api.setConsent(true);assert.equal(x.scripts.length,1);assert.equal(x.scripts[0].src,'https://connect.facebook.net/en_US/fbevents.js');
  assert(x.calls().some(a=>a[0]==='set'&&a[1]==='autoConfig'&&a[2]===false));assert.equal(x.calls().filter(a=>a[2]==='PageView').length,1);
  assert.equal(x.calls().find(a=>a[0]==='init').length,2,'No advanced matching identity object');
});
test('only a valid saved reference sends Lead, once per reference, without form fields',()=>{
  const x=setup({choice:{value:'allow',at:Date.now()}});for(const r of [null,false,'failed','someone@example.com','RH-20261124-ABCDEF123456','RH-20261124-ABCDEF123456'])x.api.lead(r);
  const leads=x.calls().filter(a=>a[2]==='Lead');assert.equal(leads.length,1);assert.equal(JSON.stringify(leads[0][3]),'{}');assert.equal(leads[0][4].eventID,'raahhi_RH-20261124-ABCDEF123456');
});
test('withdrawal stops Lead and cross-tab withdrawal sends revoke',()=>{
  const x=setup({choice:{value:'allow',at:Date.now()}});x.api.setConsent(false);x.api.lead('RH-20261124-ABCDEF123456');assert.equal(x.calls().filter(a=>a[2]==='Lead').length,0);assert.deepEqual(x.calls().at(-1),['consent','revoke']);
  x.api.setConsent(true);x.storage.delete('raahhi.ads.choice.v1');x.events.storage({key:'raahhi.ads.choice.v1'});assert.deepEqual(x.calls().at(-1),['consent','revoke']);
});
test('GPC, DNT and unavailable storage prevent tracking even after a grant attempt',()=>{
  for(const options of [{gpc:true},{dnt:'1'},{storageFails:true}]){const x=setup({...options,choice:{value:'allow',at:Date.now()}});x.api.setConsent(true);x.api.lead('RH-20261124-ABCDEF123456');assert.equal(x.scripts.length,0);}
});
test('prerendering cannot create a tracker',()=>{const x=setup({search:'?__prerender=1',choice:{value:'allow',at:Date.now()}});assert.equal(x.api,undefined);assert.equal(x.scripts.length,0);});
