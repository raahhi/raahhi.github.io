import {json,readJSON} from '../shared/http.mjs';
import pages from './pages.json' with {type:'json'};
import {networkAddress,deviceInfo} from './device.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const stages=['Browsing','Enquiry opened','Form started','Save attempted','Enquiry saved','WhatsApp clicked'];
const ranks={page_view:0,page_engagement:0,enquiry_open:1,form_start:2,form_error:2,save_started:3,save_failed:3,enquiry_saved:4,whatsapp_click:5,email_click:0,phone_click:0};
const DEVICES=['mobile','tablet','desktop'], SOURCES=['Direct / unknown','Google','Bing','Instagram','Facebook','Other referral'];
const allowed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
function validate(data){
  if(!allowed(data,['sessionId','consent','device','source','events','noticeVersion'])||data.consent!==true||(data.noticeVersion!==undefined&&data.noticeVersion!==2)||typeof data.sessionId!=='string'||!UUID.test(data.sessionId)||!DEVICES.includes(data.device)||!SOURCES.includes(data.source)||!Array.isArray(data.events)||!data.events.length||data.events.length>10)throw Error('invalid_activity');
  const now=Date.now();
  const events=data.events.map(e=>{
    if(!allowed(e,['id','sequence','at','type','page','seconds','scroll'])||typeof e.id!=='string'||!UUID.test(e.id)||typeof e.at!=='string'||e.at.length>40||typeof e.page!=='string'||typeof e.type!=='string'||!Number.isSafeInteger(e.sequence)||e.sequence<1||e.sequence>400||!Object.hasOwn(ranks,e.type)||!Object.hasOwn(pages,e.page))throw Error('invalid_activity');
    const date=Date.parse(e.at);if(!Number.isFinite(date)||date<now-86400000||date>now+300000||!Number.isInteger(e.seconds)||e.seconds<0||e.seconds>1800||!Number.isInteger(e.scroll)||e.scroll<0||e.scroll>100)throw Error('invalid_activity');
    if(e.type!=='page_engagement'&&(e.seconds||e.scroll))throw Error('invalid_activity');
    return {...e,at:new Date(date).toISOString()};
  });
  if(new Set(events.map(e=>e.id)).size!==events.length||new Set(events.map(e=>e.sequence)).size!==events.length)throw Error('invalid_activity');
  return {...data,events:events.sort((a,b)=>a.sequence-b.sequence)};
}
export async function collect(request,env){
  const origin=request.headers.get('Origin'),cors=origin==='https://raahhi.com'?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const reply=(value,status=200)=>json(value,status,cors);
  if(origin!=='https://raahhi.com')return reply({error:'origin_not_allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(request.headers.get('Sec-GPC')==='1'||request.headers.get('DNT')==='1')return reply({accepted:false},202);
  let data;try{data=validate(await readJSON(request,10000));}catch{return reply({error:'invalid_activity'},400);}
  try{
    if(!env.DB||!env.TURNSTILE_SECRET)return reply({error:'unavailable'},503);
    const now=new Date().toISOString(),epoch=Math.floor(Date.now()/1000),day='day:'+now.slice(0,10);
    const limit=await env.DB.prepare('SELECT requests,events FROM visitor_limits WHERE bucket=?').bind(day).first();
    if(limit&&(limit.requests>=2000||limit.events+data.events.length>5000))return reply({error:'daily_activity_limit'},429);
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TURNSTILE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const raw='visitor:'+Math.floor(epoch/3600)+':'+(request.headers.get('CF-Connecting-IP')||'unknown');
    const bucket='ip:'+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))),v=>v.toString(16).padStart(2,'0')).join('');
    const rate=await env.DB.prepare('SELECT requests FROM visitor_limits WHERE bucket=?').bind(bucket).first();
    if(rate?.requests>=600)return reply({error:'activity_rate_limit'},429);
    const existing=await env.DB.prepare('SELECT event_count FROM visitor_sessions WHERE id=?').bind(data.sessionId).first();
    if(existing?.event_count>=400)return reply({error:'session_activity_limit'},429);
    const first=data.events[0],last=data.events.at(-1),rank=Math.max(...data.events.map(e=>ranks[e.type]));
    const country=/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'ZZ';
    // Legacy clients agreed to the earlier notice that excluded stored IP/browser details.
    const ip=data.noticeVersion===2?networkAddress(request.headers.get('CF-Connecting-IP')):'';
    const device=data.noticeVersion===2?deviceInfo(request.headers.get('User-Agent')):{browser:'',major:'',os:'',device:null};
    // Conditions are repeated inside one D1 transaction so concurrent requests cannot bypass the daily cap.
    const grant="EXISTS(SELECT 1 FROM visitor_limits WHERE bucket=? AND requests<=2000 AND events<=5000) AND EXISTS(SELECT 1 FROM visitor_limits WHERE bucket=? AND requests<=600)";
    const queries=[
      env.DB.prepare('INSERT INTO visitor_limits(bucket,requests,events,expires_at) VALUES (?,1,?,?) ON CONFLICT(bucket) DO UPDATE SET requests=requests+1,events=events+excluded.events').bind(day,data.events.length,epoch+172800),
      env.DB.prepare('INSERT INTO visitor_limits(bucket,requests,events,expires_at) VALUES (?,1,0,?) ON CONFLICT(bucket) DO UPDATE SET requests=requests+1').bind(bucket,epoch+7200),
      env.DB.prepare(`INSERT INTO visitor_sessions(id,first_seen,last_seen,entry_page,last_page,last_sequence,last_type,stage,device,source,country,ip_address,browser,browser_major,operating_system,notice_version,event_count)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0 WHERE ${grant}
        ON CONFLICT(id) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen),
        entry_page=CASE WHEN excluded.first_seen<first_seen THEN excluded.entry_page ELSE entry_page END,first_seen=MIN(first_seen,excluded.first_seen),
        last_page=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.last_page ELSE last_page END,
        ip_address=CASE WHEN excluded.last_sequence>last_sequence AND excluded.ip_address<>'' THEN excluded.ip_address ELSE ip_address END,
        browser=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.browser ELSE browser END,browser_major=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.browser_major ELSE browser_major END,
        notice_version=MAX(notice_version,excluded.notice_version),operating_system=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.operating_system ELSE operating_system END,
        device=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.device ELSE device END,
        last_type=CASE WHEN excluded.last_sequence>last_sequence THEN excluded.last_type ELSE last_type END,last_sequence=MAX(last_sequence,excluded.last_sequence),stage=MAX(stage,excluded.stage)`).bind(data.sessionId,first.at,last.at,first.page,last.page,last.sequence,last.type,rank,device.device||data.device,data.source,country,ip,device.browser,device.major,device.os,data.noticeVersion||1,day,bucket),
      ...data.events.map(e=>env.DB.prepare(`INSERT OR IGNORE INTO visitor_events(id,session_id,sequence,occurred_at,received_at,type,page,seconds,scroll)
        SELECT ?,?,?,?,?,?,?,?,? WHERE ${grant}`).bind(e.id,data.sessionId,e.sequence,e.at,now,e.type,e.page,e.seconds,e.scroll,day,bucket)),
      env.DB.prepare('UPDATE visitor_sessions SET event_count=(SELECT COUNT(*) FROM visitor_events WHERE session_id=?) WHERE id=?').bind(data.sessionId,data.sessionId),
      env.DB.prepare('DELETE FROM visitor_events WHERE id IN (SELECT id FROM visitor_events WHERE received_at<? LIMIT 20)').bind(new Date(Date.now()-30*86400000).toISOString()),
      env.DB.prepare('DELETE FROM visitor_sessions WHERE id IN (SELECT id FROM visitor_sessions WHERE last_seen<? LIMIT 10)').bind(new Date(Date.now()-30*86400000).toISOString()),
      env.DB.prepare('DELETE FROM visitor_limits WHERE bucket IN (SELECT bucket FROM visitor_limits WHERE expires_at<? LIMIT 10)').bind(epoch)
    ];
    const result=await env.DB.batch(queries);
    if(!result[2].meta.changes)return reply({error:'activity_limit'},429);
    return reply({accepted:true},202);
  }catch{return reply({error:'activity_unavailable'},503);}
}
export async function report(url,env){
  const days=Number(url.searchParams.get('days')||7);if(![1,7,30].includes(days))return json({error:'invalid_period'},400);
  const cutoff=new Date(Date.now()-days*86400000).toISOString();
  if(url.pathname==='/api/visitors'){
    const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>5000)return json({error:'invalid_offset'},400);
    const {results}=await env.DB.prepare('SELECT * FROM visitor_sessions WHERE last_seen>=? ORDER BY last_seen DESC,id LIMIT 51 OFFSET ?').bind(cutoff,offset).all();
    return json({sessions:results.slice(0,50),more:results.length>50,pages,stages});
  }
  if(url.pathname==='/api/visitor-stats'){
    // Actions are counted independently: a direct WhatsApp click is never treated as a saved enquiry.
    const totals=await env.DB.prepare(`SELECT COUNT(*) AS sessions,SUM(opened) AS opened,SUM(started) AS started,SUM(attempted) AS attempted,SUM(saved) AS saved,SUM(whatsapp) AS whatsapp FROM
      (SELECT s.id,MAX(CASE WHEN e.type='enquiry_open' THEN 1 ELSE 0 END) AS opened,
      MAX(CASE WHEN e.type='form_start' THEN 1 ELSE 0 END) AS started,MAX(CASE WHEN e.type='save_started' THEN 1 ELSE 0 END) AS attempted,
      MAX(CASE WHEN e.type='enquiry_saved' THEN 1 ELSE 0 END) AS saved,MAX(CASE WHEN e.type='whatsapp_click' THEN 1 ELSE 0 END) AS whatsapp
      FROM visitor_sessions s LEFT JOIN visitor_events e ON e.session_id=s.id WHERE s.last_seen>=? GROUP BY s.id)`).bind(cutoff).first();
    const {results:products}=await env.DB.prepare("SELECT e.page,COUNT(*) AS views,COUNT(DISTINCT e.session_id) AS sessions FROM visitor_events e WHERE e.received_at>=? AND e.type='page_view' AND (e.page LIKE '/activities/%/%/' AND e.page NOT LIKE '/activities/categories/%' OR e.page LIKE '/holidays/%/%/' OR e.page LIKE '/visas/%/') GROUP BY e.page ORDER BY views DESC LIMIT 20").bind(cutoff).all();
    return json({totals,products,pages,stages});
  }
  const id=url.pathname.match(/^\/api\/visitors\/([0-9a-f-]{36})$/)?.[1];
  if(id&&UUID.test(id)){
    const session=await env.DB.prepare('SELECT * FROM visitor_sessions WHERE id=? AND last_seen>=?').bind(id,cutoff).first();
    if(!session)return json({error:'not_found'},404);
    const {results:events}=await env.DB.prepare('SELECT sequence,occurred_at,type,page,seconds,scroll FROM visitor_events WHERE session_id=? AND received_at>=? ORDER BY sequence LIMIT 400').bind(id,new Date(Date.now()-30*86400000).toISOString()).all();
    return json({session,events,pages,stages});
  }
  return json({error:'not_found'},404);
}
