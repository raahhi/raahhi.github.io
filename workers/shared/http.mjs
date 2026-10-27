export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',...headers}});
}
export async function readJSON(request, limit = 20000) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('json_required');
  if (Number(request.headers.get('Content-Length')) > limit) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  let size = 0, chunks = [];
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  const data = JSON.parse(new TextDecoder().decode(all));
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('invalid_body');
  return data;
}
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('invalid_field');
  return value.trim().replace(/\u0000/g,'');
}
