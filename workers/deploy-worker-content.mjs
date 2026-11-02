import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
const DATABASE_ID = 'cfe504d7-065f-48bb-bd03-933f3cbdb495';
const ACCOUNT_ID = '772efea0374e61ce65ebc823dc78e1c1';
// This API updates code only. It does not manage routes, domains, Access, secrets or settings.
// https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/content/methods/update/
export async function deployContent(name, {token,account,fetcher=fetch,bundler=build}={}) {
  if (!['raahhi-leads','raahhi-enquiries'].includes(name)) throw Error('Only the two enquiry Workers may be deployed.');
  if (!token || token !== token.trim() || /\s/.test(token) || account !== ACCOUNT_ID) throw Error('Invalid deployment credentials or account.');
  const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name;
  async function api(path,options={}) {
    const response=await fetcher(base+path,{...options,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
    const data=await response.json();
    if (!response.ok || data.success!==true) throw Error(name+' '+(options.method||'GET')+' '+path+' rejected: HTTP '+response.status+'; codes '+(data.errors||[]).map(e=>e.code).join(','));
    return data.result;
  }
  const before=await api('/settings');
  const bindings=before.bindings||[];
  const db=bindings.find(b=>b.name==='DB'&&b.type==='d1');
  if (!db || (db.id||db.database_id)!==DATABASE_ID) throw Error(name+' must already bind DB to the enquiry database. No code was uploaded.');
  if (name==='raahhi-enquiries' && !bindings.some(b=>b.name==='TURNSTILE_SECRET'&&b.type==='secret_text')) throw Error('Save TURNSTILE_SECRET as an encrypted secret before deploying the public API.');
  const result=await bundler({entryPoints:[new URL(name==='raahhi-leads'?'./leads/index.mjs':'./enquiries/index.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',loader:{'.html':'text','.js':'text'},legalComments:'none'});
  const body=new FormData();
  body.set('metadata',new Blob([JSON.stringify({main_module:'worker.mjs'})],{type:'application/json'}),'metadata.json');
  body.set('worker.mjs',new Blob([result.outputFiles[0].contents],{type:'application/javascript+module'}),'worker.mjs');
  await api('/content',{method:'PUT',body});
  const after=await api('/settings');
  const bindingSnapshot=bs=>JSON.stringify(bs.map(b=>Object.fromEntries(Object.entries(b).sort(([a],[z])=>a.localeCompare(z)))).sort((a,b)=>a.name.localeCompare(b.name)));
  if (bindingSnapshot(before.bindings||[])!==bindingSnapshot(after.bindings||[]) || before.compatibility_date!==after.compatibility_date || JSON.stringify(before.compatibility_flags||[])!==JSON.stringify(after.compatibility_flags||[])) throw Error('Post-upload configuration check failed; investigate before activating website forms.');
  console.log(name+': code uploaded; database bindings, secrets and compatibility settings preserved.');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  await deployContent(process.argv[2],{token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID});
}
