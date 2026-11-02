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


## Independent visitor activity

The protected dashboard has separate Customer enquiries and Visitor activity sections. `/api/activity` collects only consented anonymous session events; it never creates an enquiry or reads form contents. Analytics tables have no lead IDs or contact fields. The analytics UI shows sessions (not unique people), entry/last pages, a timeline, approximate visible-page time/scroll, observed enquiry steps, direct-contact clicks and product rankings. WhatsApp clicks are never interpreted as messages or saved enquiries. Inactivity after 20 minutes is an estimate based on the last received event, not proof of an exit.

Collection starts only after an explicit Allow analytics choice. Declining, withdrawal, Global Privacy Control and Do Not Track disable collection; enquiry saving works independently. The choice lives in local storage for up to 180 days; session ID and sequence use session storage with a 30-minute inactivity window. No raw IPs, raw referrers, query strings, search terms, field values, recordings or permanent visitor fingerprints are stored. The backend rejects extra payload fields and only accepts the 270 known site paths in `analytics/pages.json`. Update this allowlist with deliberate catalogue changes.

Free-plan safeguards: at most 10 events per request, 400 events per session, 600 requests per hourly HMAC IP bucket, and 2,000 requests / 5,000 submitted events per UTC day globally. Counters are independent of enquiry rate limits. These caps intentionally allow data gaps and do not guarantee sufficient account-wide free quota if other services consume it. Activity failures never block the enquiry flow. No plan upgrades are made. Reporting is limited to 30 days. Old rows are deleted in bounded batches on new activity requests; physical cleanup can lag without traffic. No new DNS, Access rules, secrets, Workers or databases are needed.

`node .github/check-visitor-activity.mjs` checks the published client against the real collector and SQLite with local browser requests only. Backend tests also cover consent, origin, strict schema, privacy field rejection, retries, order, independent WhatsApp counts, daily caps and cleanup. Live data starts only after publication and a visitor opts in; no earlier browsing history is reconstructed.
