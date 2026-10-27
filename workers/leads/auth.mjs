const ISSUER = 'https://broken-cell-af0b.cloudflareaccess.com';
const AUDIENCE = '107ea63d11aceae9580acda33b01d5b9ed50092d2dddfaedcbd95595049ad1ae';
let cached;
function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_jwt');
  return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
}
export async function authenticate(request, fetcher = fetch) {
  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16000) return null;
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))), claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Math.floor(Date.now()/1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== ISSUER || !Array.isArray(claims.aud) || !claims.aud.includes(AUDIENCE) || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now+30 || (claims.nbf && claims.nbf > now+30) || typeof claims.email !== 'string' || !claims.email.includes('@') || !claims.sub) return null;
    if (!cached || cached.until <= Date.now() || !cached.keys.some(k=>k.kid === header.kid)) {
      const response = await fetcher(ISSUER+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(8000)});
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data.keys)) return null;
      cached = {keys:data.keys,until:Date.now()+300000};
    }
    const jwk = cached.keys.find(k=>k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
    return valid ? {email:claims.email,sub:claims.sub} : null;
  } catch { return null; }
}
