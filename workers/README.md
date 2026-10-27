# RAAHHI enquiries

Two isolated Workers share only the `raahhi-enquiries` D1 database. Existing DNS, email, Pages hosting and accounting resources are not managed by this workflow.

- `raahhi-enquiries`: POST `/api/enquiries`, restricted website origin, mandatory production Turnstile Siteverify including hostname/action, bounded validated payloads, idempotency and short-lived secret-keyed rate buckets. `/health` exposes readiness, never lead data.
- `raahhi-leads`: canonical host `leads.raahhi.com`, cryptographically verified Cloudflare Access JWT with the audience/issuer observed for this application. Every route including scripts, CSV and JSON requires authentication. Other hostnames redirect to the protected canonical domain. Preview URLs are disabled. Access policies must continue to allow only the intended owner; this code relies on that application's allow policy and does not introduce additional users.
- Both configs deliberately omit routes, preserving domain connections managed by the administrator. `keep_vars` preserves dashboard configuration. `DB` is explicitly pinned to the new database. Secret values are never committed.

## Configuration

GitHub Actions secrets: `RAAHHI_ENQUIRIES_CF_API_TOKEN`, `RAAHHI_ENQUIRIES_CF_ACCOUNT_ID`. Token needs Editor for both named Workers and D1 Edit for the enquiry DB where resource restrictions are available. The public Worker requires the separately saved `TURNSTILE_SECRET` secret. Production public Site Key supplied by owner: `0x4AAAAAAFn57XPr9uHfgf7C`; widget hostname `raahhi.com`, action `enquiry`.

The deployment workflow tests, applies additive migrations, deploys dashboard before API, and checks public readiness. It does not enable the website forms. Never migrate the accounting database or add DNS/zone permissions for this workflow.

## Current scope

Dashboard lists/searches/filter enquiries, opens WhatsApp/email links, saves notes/status with optimistic concurrency and exports at most 5,000 recent records. It does not read or sync WhatsApp conversations, send WhatsApp messages, place bookings or collect payment. Email notification is explicitly `not_configured`; no notification provider is connected. Review this dashboard to find enquiries until an email provider is separately configured.

## Verification

`node --test workers/tests/backend.test.mjs` (Node 22+ and root npm dependencies).
`npx --yes wrangler@4.153.0 deploy --dry-run --config workers/leads/wrangler.jsonc`

Local tests cover validation, wrong-origin rejection, real verification requirements, storage, idempotency/conflicts, rate limits, JWT signature/audience/expiry, alternate-host isolation, authenticated search/status/notes/CSRF and CSV formula protection. They simulate external verification and do not submit real customer enquiries or send messages.

Before website activation: verify deployed health, owner login/dashboard, correct Access allow policy, alternate-host redirects and a real owner-authorized submission. Update enquiry disclosures/privacy alongside form activation. An unavailable backend must preserve typed details and offer honest manual contact fallback; never claim a failed save succeeded.
