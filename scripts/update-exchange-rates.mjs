import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const CODES=['AED','INR','USD','EUR','GBP','SAR','QAR','KWD','OMR','BHD','AUD','CAD','SGD','CNY','JPY','CHF','NZD','HKD'];
export function validateRates(data, now=Date.now()){
  if(data.result!=='success'||data.base_code!=='USD'||data.rates?.USD!==1||!Number.isFinite(data.time_last_update_unix)||data.time_last_update_unix*1000>now+300000||now-data.time_last_update_unix*1000>72*3600000)throw Error('Invalid or stale USD exchange-rate response');
  for(const c of CODES)if(!Number.isFinite(data.rates[c])||data.rates[c]<=0)throw Error('Missing or invalid '+c+' rate');
  return {updatedAt:data.time_last_update_unix,rates:Object.fromEntries(CODES.map(c=>[c,data.rates[c]]))};
}
export async function updateRates({fetcher=fetch,path='source/raahhi-tours52.html'}={}){
  const source=await readFile(path,'utf8'), match=source.match(/^const FX_RATES = (.*);$/m);
  if(!match)throw Error('Missing saved FX rates');
  const saved=JSON.parse(match[1]);
  try{
    const r=await fetcher('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('Rate provider HTTP '+r.status);
    const latest=validateRates(await r.json());
    if(latest.updatedAt<saved.updatedAt)throw Error('Provider returned older rates');
    const line='const FX_RATES = '+JSON.stringify(latest)+';';
    if(line!==match[0])await writeFile(path,source.replace(match[0],line));
    console.log('USD rates checked; provider timestamp '+new Date(latest.updatedAt*1000).toISOString());
    return latest;
  }catch(e){
    if(!saved.rates||CODES.some(c=>!Number.isFinite(saved.rates[c])||saved.rates[c]<=0))throw Error('No valid exchange-rate fallback');
    console.warn('Keeping last saved exchange rates: '+e.message);
    return saved;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await updateRates();
