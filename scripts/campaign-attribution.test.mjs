import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('./campaign-attribution.js',import.meta.url),'utf8');
const query='?utm_source=ig&utm_medium=paid_social&utm_campaign=dubai_holiday_launch_202611&utm_content=dubai_quote_v1&utm_id=123456789&utm_term=234567891&ad_id=345678912&fbclid=PRIVATE_CLICK&email=PRIVATE_EMAIL';
function setup({consent='allow',blocked=false,search=query,stored=new Map()}={}){
 const local=new Map([['raahhi.analytics.choice.v3',JSON.stringify({value:consent,at:Date.now()})]]);
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const ctx={window:{},navigator:{globalPrivacyControl:blocked},localStorage:storage(local),sessionStorage:storage(stored),location:{search},URLSearchParams,Date};vm.runInNewContext(script,ctx);return {api:ctx.window.raahhiCampaign,stored,ctx};
}
test('only known labels and numeric ad IDs survive into enquiry details',()=>{const {api,stored}=setup();const value=api.get();assert.equal(value.platform,'Instagram');assert.equal(value.adId,'345678912');const details=JSON.stringify(api.details());assert(details.includes('dubai_holiday_launch_202611'));assert(!details.includes('PRIVATE'));assert(!JSON.stringify([...stored]).includes('PRIVATE'));});
test('attribution survives clean navigation and expires after 30 minutes',()=>{const first=setup();first.api.get();const second=setup({search:'',stored:first.stored});assert.equal(second.api.get().campaign,'dubai_holiday_launch_202611');const saved=JSON.parse(first.stored.get('raahhi.campaign.v1'));saved.at-=31*60000;first.stored.set('raahhi.campaign.v1',JSON.stringify(saved));assert.equal(second.api.get(),null);});
test('decline and browser privacy signals prevent capture and clear stored labels',()=>{for(const options of [{consent:'decline'},{blocked:true}]){const {api,stored}=setup({...options,stored:new Map([['raahhi.campaign.v1','private']])});assert.equal(api.get(),null);assert.equal(stored.size,0);}});
test('unknown campaigns and nonnumeric IDs are excluded',()=>{assert.equal(setup({search:query.replace('dubai_holiday_launch_202611','someone@example.com')}).api.get(),null);const {api}=setup({search:query.replace('345678912','someone@example.com')});assert.equal(api.get().adId,undefined);});
