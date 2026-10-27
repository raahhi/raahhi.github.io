import {json,readJSON,text} from '../shared/http.mjs';
import {authenticate} from './auth.mjs';
import html from './dashboard.html';
import script from './dashboard.js';
const HOME = 'https://leads.raahhi.com';
const STATUSES = ['new','contacted','follow_up','booked','closed'];
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  // Alternate and preview hosts can never serve customer records.
  if (url.origin !== HOME) return new Response(null,{status:302,headers:{Location:HOME+'/','Cache-Control':'no-store'}});
  const user = await authenticate(request,fetcher);
  if (!user) return json({error:'authentication_required'},401);
  if (!['GET','POST'].includes(request.method)) return json({error:'method_not_allowed'},405);
  if (request.method === 'POST' && (request.headers.get('Origin') !== HOME || request.headers.get('X-RAAHHI-Request') !== 'dashboard')) return json({error:'origin_not_allowed'},403);
  const security = {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
  if (url.pathname === '/' && request.method === 'GET') return new Response(html,{headers:{...security,'Content-Type':'text/html; charset=utf-8'}});
  if (url.pathname === '/dashboard.js' && request.method === 'GET') return new Response(script,{headers:{...security,'Content-Type':'application/javascript; charset=utf-8'}});
  if (url.pathname === '/api/me' && request.method === 'GET') return json({email:user.email});
  try {
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      const status = url.searchParams.get('status') || '', q = (url.searchParams.get('q') || '').trim().slice(0,120);
      if (status && !STATUSES.includes(status)) return json({error:'invalid_filter'},400);
      const clauses = [], params = [];
      if (status) { clauses.push('status = ?'); params.push(status); }
      if (q) { clauses.push("(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR product LIKE ? ESCAPE '\\' OR reference LIKE ? ESCAPE '\\')"); const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%'; params.push(...Array(5).fill(pattern)); }
      const cursor = url.searchParams.get('cursor');
      if (cursor) {
        let c; try { c=JSON.parse(atob(cursor)); } catch { return json({error:'invalid_cursor'},400); }
        if (!Array.isArray(c) || c.length !== 2 || !c.every(x=>typeof x === 'string' && x.length < 100)) return json({error:'invalid_cursor'},400);
        clauses.push('(created_at < ? OR (created_at = ? AND id < ?))'); params.push(c[0],c[0],c[1]);
      }
      const where = clauses.length ? ' WHERE '+clauses.join(' AND ') : '';
      const {results} = await env.DB.prepare('SELECT id,reference,created_at,updated_at,kind,name,phone,email,product,status,version,notification_status FROM enquiries'+where+' ORDER BY created_at DESC,id DESC LIMIT 51').bind(...params).all();
      const more=results.length>50, rows=results.slice(0,50), last=rows.at(-1);
      return json({leads:rows,cursor:more?btoa(JSON.stringify([last.created_at,last.id])):null});
    }
    const match = url.pathname.match(/^\/api\/leads\/([0-9a-f-]{36})$/);
    if (match && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?').bind(match[1]).first();
      if (!row) return json({error:'not_found'},404);
      delete row.request_hash; delete row.request_id;
      row.details=JSON.parse(row.details); return json(row);
    }
    if (match && request.method === 'POST') {
      let data; try { data=await readJSON(request,14000); text(data.notes,10000); } catch { return json({error:'invalid_update'},400); }
      if (!STATUSES.includes(data.status) || !Number.isSafeInteger(data.version) || data.version < 1) return json({error:'invalid_update'},400);
      const result = await env.DB.prepare('UPDATE enquiries SET status=?,notes=?,updated_at=?,updated_by=?,version=version+1 WHERE id=? AND version=?').bind(data.status,data.notes.trim(),new Date().toISOString(),user.email,match[1],data.version).run();
      return result.meta.changes ? json({saved:true,version:data.version+1}) : json({error:'changed_elsewhere'},409);
    }
    if (url.pathname === '/api/export' && request.method === 'GET') {
      // Explicit owner download only. Cap export to protect the free plan and disclose the cap in UI.
      const {results} = await env.DB.prepare('SELECT reference,created_at,kind,name,email,phone,product,page,status,notes,details FROM enquiries ORDER BY created_at DESC,id DESC LIMIT 5000').all();
      const columns=['reference','created_at','kind','name','email','phone','product','page','status','notes','details'];
      const csv='\uFEFF'+[columns.map(csvCell).join(','),...results.map(row=>columns.map(k=>csvCell(row[k])).join(','))].join('\r\n');
      return new Response(csv,{headers:{...security,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="raahhi-enquiries.csv"'}});
    }
    return json({error:'not_found'},404);
  } catch { return json({error:'temporarily_unavailable'},503); }
}
export default {fetch:(request,env)=>handle(request,env)};
