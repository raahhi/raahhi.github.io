# RAAHHI enquiries

Two isolated Workers share only the `raahhi-enquiries` D1 database. Existing DNS, email, Pages hosting and accounting resources are not managed by this workflow.

- `raahhi-enquiries`: POST `/api/enquiries`, restricted website origin, mandatory production Turnstile Siteverify including hostname/action, bounded validated payloads, idempotency and short-lived secret-keyed rate buckets. `/health` exposes readiness, never lead data.
- `raahhi-leads`: canonical host `leads.raahhi.com`, cryptographically verified Cloudflare Access JWT with the audience/issuer observed for this application. Every route including scripts, CSV and JSON requires authentication. Other hostnames redirect to the protected canonical domain. Preview hosts can never serve customer data; the content-only deployment preserves existing preview settings. Access policies must continue to allow only the intended owner; this code relies on that application's allow policy and does not introduce additional users.
- Both configs deliberately omit routes, preserving domain connections managed by the administrator. `keep_vars` preserves dashboard configuration. `DB` is explicitly pinned to the new database. Secret values are never committed.

## Configuration

GitHub Actions secrets: `RAAHHI_ENQUIRIES_CF_API_TOKEN`, `RAAHHI_ENQUIRIES_CF_ACCOUNT_ID`. Token needs Editor for both named Workers and D1 Edit for the enquiry DB where resource restrictions are available. The public Worker requires the separately saved `TURNSTILE_SECRET` secret. Production public Site Key supplied by owner: `0x4AAAAAAFn57XPr9uHfgf7C`; widget hostname `raahhi.com`, action `enquiry`.

The deployment workflow tests, applies additive migrations, deploys dashboard before API using the code-only Worker Content API, and checks public readiness. The content API deliberately leaves dashboard-managed configuration untouched; deployment verifies the existing DB binding and encrypted Turnstile secret before upload and compares bindings/compatibility settings afterwards. This avoids Wrangler’s dashboard-takeover metadata fetch, which can require unrelated domain permissions. The separate Pages workflow publishes the website form connection. Never migrate the accounting database or add DNS/zone permissions for this workflow.

## Current scope

Dashboard lists/searches/filter enquiries, opens WhatsApp/email links, saves notes/status with optimistic concurrency and exports at most 5,000 recent records. It does not read or sync WhatsApp conversations, send WhatsApp messages, place bookings or collect payment. Email notification is explicitly `not_configured`; no notification provider is connected. Review this dashboard to find enquiries until an email provider is separately configured.

## Verification

`node --test workers/tests/*.test.mjs` (Node 22+ and root npm dependencies).
`npx --yes wrangler@4.153.0 deploy --dry-run --config workers/leads/wrangler.jsonc`

Local tests cover validation, wrong-origin rejection, real verification requirements, storage, idempotency/conflicts, rate limits, JWT signature/audience/expiry, alternate-host isolation, authenticated search/status/notes/CSRF and CSV formula protection. They simulate external verification and do not submit real customer enquiries or send messages.

Website forms now POST validated contact, general, activity, holiday and visa enquiries to the public Worker. Turnstile loads only after a valid submission. The UI displays a reference and WhatsApp handoff only after a confirmed database save; failed saves preserve fields and offer direct manual contact. Retry IDs stay in memory and protect against duplicate records. Privacy and form disclosures explain storage.

After `npm run build`, run `node .github/check-enquiry-delivery.mjs` for the real client-to-Worker-to-SQLite integration check with simulated external verification. This covers failure recovery, idempotency, escaping, product context and duplicate prevention without creating production leads.

Live backend health and both Access entry points have been checked; the owner has confirmed dashboard login. The final production check is an owner submission using the real Turnstile widget, followed by finding its displayed reference in the dashboard. A successful automated test does not prove production Turnstile configuration or WhatsApp delivery. Customers must press Send in WhatsApp themselves.
