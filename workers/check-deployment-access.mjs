// Print only verification outcomes and API error codes, never credentials or headers.
const token = process.env.CLOUDFLARE_API_TOKEN || '';
const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
if (!token) throw Error('Missing RAAHHI_ENQUIRIES_CF_API_TOKEN repository secret.');
if (token !== token.trim() || /\s/.test(token) || /^Bearer\b/i.test(token) || /^["']|["']$/.test(token)) throw Error('Save only the raw API token, without whitespace, quotes or Bearer.');
if (token.startsWith('0x')) throw Error('The deployment secret contains a Turnstile key, not a Cloudflare API token.');
if (account !== '772efea0374e61ce65ebc823dc78e1c1') throw Error('The account ID secret does not match the account containing the enquiry database.');
async function check(label, path, options = {}) {
  const response = await fetch('https://api.cloudflare.com/client/v4'+path, {
    ...options,
    headers: {Authorization:'Bearer '+token,'Content-Type':'application/json'},
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const ok = response.ok && data.success === true;
  const codes = (data.errors || []).map(e=>e.code).filter(Number.isFinite);
  console.log(JSON.stringify({check:label,http_status:response.status,success:ok,error_codes:codes,...(ok && data.result?.status ? {token_status:data.result.status} : {})}));
  return {ok,status:data.result?.status};
}
const accountToken = await check('account_token_verification','/accounts/'+account+'/tokens/verify');
let valid = accountToken.ok && accountToken.status === 'active';
if (!valid) {
  const userToken = await check('user_token_verification','/user/tokens/verify');
  valid = userToken.ok && userToken.status === 'active';
}
const database = await check('enquiry_database_query','/accounts/'+account+'/d1/database/cfe504d7-065f-48bb-bd03-933f3cbdb495/query',{method:'POST',body:JSON.stringify({sql:'SELECT 1 AS access_check',params:[]})});
if (!database.ok) throw Error(valid ? 'The token is active but cannot query the enquiry database. Check its D1 Edit/Write permission and account scope.' : 'Cloudflare did not verify this token as active for the configured account, and the enquiry database query was rejected. Ask the administrator to verify the saved token value, account, expiry and permissions.');
console.log('Enquiry database access verified; continuing deployment.');
