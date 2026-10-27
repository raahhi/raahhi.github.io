import {json, readJSON, digest, text} from '../shared/http.mjs';
const ORIGIN = 'https://raahhi.com';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(data) {
  if (!UUID.test(data.requestId || '') || data.website) throw new Error('invalid_request');
  const kind = text(data.kind,20,true);
  if (!['general','activity','holiday','visa','contact'].includes(kind)) throw new Error('invalid_kind');
  const name = text(data.name,120,true), phone = text(data.phone,60,true), email = text(data.email || '',254);
  if (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g,'').length < 7 || phone.replace(/\D/g,'').length > 15) throw new Error('invalid_phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  if (['visa','contact'].includes(kind) && !email) throw new Error('invalid_email');
  const page = new URL(text(data.page,500,true));
  if (page.origin !== ORIGIN || page.username || page.password) throw new Error('invalid_page');
  page.search = ''; page.hash = '';
  const product = text(data.product || '',200);
  if (!Array.isArray(data.details) || !data.details.length || data.details.length > 60) throw new Error('invalid_details');
  const details = data.details.map(row => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('invalid_details');
    return [text(row[0],80,true),text(row[1],3000)];
  });
  const clean = {kind,name,phone,email,product,page:page.href,details};
  if (JSON.stringify(clean).length > 16000) throw new Error('too_large');
  return clean;
}
export async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const cors = origin === ORIGIN ? {'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'} : {};
  const reply = (data, status=200) => json(data,status,cors);
  if (url.pathname === '/health' && request.method === 'GET') {
    try {
      await env.DB.prepare('SELECT id FROM enquiries LIMIT 1').first();
      return reply({service:'raahhi-enquiries',ready:!!env.TURNSTILE_SECRET,version:1});
    } catch { return reply({service:'raahhi-enquiries',ready:false},503); }
  }
  if (url.pathname !== '/api/enquiries') return reply({error:'not_found'},404);
  if (origin !== ORIGIN) return reply({error:'origin_not_allowed'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if (request.method !== 'POST') return reply({error:'method_not_allowed'},405);
  if (!env.TURNSTILE_SECRET || !env.DB) return reply({error:'temporarily_unavailable'},503);
  let data, clean;
  try { data = await readJSON(request); clean = validate(data); text(data.turnstileToken,2048,true); }
  catch (e) { return reply({error:e.message === 'too_large' ? 'too_large' : 'invalid_enquiry'},e.message === 'too_large' ? 413 : 400); }
  try {
    const check = await fetcher(SITEVERIFY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:data.turnstileToken,idempotency_key:crypto.randomUUID()}),signal:AbortSignal.timeout(10000)});
    if (!check.ok) return reply({error:'verification_unavailable'},503);
    const proof = await check.json();
    if (!proof.success || proof.hostname !== 'raahhi.com' || proof.action !== 'enquiry') return reply({error:'verification_failed'},400);
    const hash = await digest(JSON.stringify(clean));
    const previous = await env.DB.prepare('SELECT reference, request_hash FROM enquiries WHERE request_id = ?').bind(data.requestId).first();
    if (previous) return previous.request_hash === hash ? reply({saved:true,reference:previous.reference}) : reply({error:'request_conflict'},409);
    const now = new Date().toISOString(), id = crypto.randomUUID();
    const reference = 'RH-' + now.slice(0,10).replaceAll('-','') + '-' + id.replaceAll('-','').slice(0,12).toUpperCase();
    // A secret-keyed, minute-scoped fingerprint avoids persisting raw visitor IPs.
    const minute = Math.floor(Date.now()/60000), ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TURNSTILE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const bucket = [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(minute+':'+ip)))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO enquiry_rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1').bind(bucket,Math.floor(Date.now()/1000)+3600),
      env.DB.prepare(`INSERT OR IGNORE INTO enquiries(id,reference,request_id,request_hash,created_at,updated_at,kind,name,email,phone,product,page,details)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count FROM enquiry_rate_limits WHERE bucket = ?) <= 5`).bind(id,reference,data.requestId,hash,now,now,clean.kind,clean.name,clean.email,clean.phone,clean.product,clean.page,JSON.stringify(clean.details),bucket),
      env.DB.prepare('DELETE FROM enquiry_rate_limits WHERE bucket IN (SELECT bucket FROM enquiry_rate_limits WHERE expires_at < ? LIMIT 100)').bind(Math.floor(Date.now()/1000))
    ]);
    if (!results[1].meta.changes) {
      const existing = await env.DB.prepare('SELECT reference,request_hash FROM enquiries WHERE request_id = ?').bind(data.requestId).first();
      if (existing) return existing.request_hash === hash ? reply({saved:true,reference:existing.reference}) : reply({error:'request_conflict'},409);
      return reply({error:'too_many_enquiries'},429);
    }
    return reply({saved:true,reference},201);
  } catch { return reply({error:'temporarily_unavailable'},503); }
}
export default {fetch: (request,env) => handle(request,env)};
