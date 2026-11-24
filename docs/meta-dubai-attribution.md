# Dubai holiday lead attribution

This release adds first-party campaign labels to the existing saved-enquiry flow. It does not launch an ad, install a Meta Pixel, or send customer enquiry fields to Meta.

## Ad destination and URL parameters

Destination: `https://raahhi.com/holidays/dubai/`

Set the following in the ad's URL parameters field, rather than putting unresolved macros into an organic caption:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign=dubai_holiday_launch_202611&utm_content=dubai_quote_v1&utm_id={{campaign.id}}&utm_term={{adset.id}}&ad_id={{ad.id}}
```

For this first campaign use Instagram and Facebook placements. The runtime recognises `ig`/`instagram` and `fb`/`facebook`. Use `dubai_quote_v2` for a second creative. The allowed campaign labels are `dubai_holiday_launch` and `dubai_holiday_launch_YYYYMM`; unsupported labels are ignored rather than accepting arbitrary URL content. Numeric campaign, ad-set and ad identifiers are optional.

## Recorded journey

- Ads Manager supplies aggregate link-click reporting once the ad is running. A post-image tap, reaction or comment is not necessarily an outbound link click.
- Existing first-party Visitor activity records consenting website sessions and their page/form events. Recognised campaign parameters identify Instagram/Facebook even when a referrer is absent.
- After analytics is allowed, sanitised campaign labels are retained in session storage across page navigation for a 30-minute window.
- A successful saved enquiry includes the campaign platform, medium, campaign label, creative and supplied numeric campaign/ad-set/ad IDs in its details, beside its existing reference. They are visible in the existing Customer enquiries detail view.
- WhatsApp opens only after enquiry saving where the existing flow offers it. A WhatsApp click is not proof of a sent message or a booking.

No raw query string, `fbclid`, names, email addresses or phone numbers are captured as campaign metadata. Declining analytics, withdrawal, browser privacy signals, blocked scripts, lost network requests and expiry leave attribution gaps. This is not a promise to identify or record every individual click. The lead form remains usable without analytics permission.

## Release checks

`node --test scripts/campaign-attribution.test.mjs workers/tests/backend.test.mjs`

The existing `.github/check-enquiry-delivery.mjs` additionally exercises a campaign landing, consent, navigation to Contact, the real frontend-to-Worker-to-SQLite save, preserved reference, ad-ID detail and exclusion of the raw click ID. The normal Pages pipeline also runs the visitor-journey regression checks before deployment.


## Meta website lead tracking (24 November 2026)

- Dataset/pixel: `RAAHHI TOURS Website`, ID `1127806210084924`.
- Connected ad account: `Raahhi Tours Ads`, ID `1731127207950349`.
- Browser Pixel only. No CAPI token or secret is committed, and no portfolio-wide automatic CAPI integration is enabled.
- Separate advertising permission (`raahhi.ads.choice.v1`, 180 days) is required. Existing analytics-only permission does not enable Meta. GPC/DNT, declined/expired/unavailable storage and prerendering prevent loading the Meta script.
- Banner choices: Allow analytics; Allow analytics & ads; Decline optional tracking. Reopen with Analytics preferences in the footer. Analytics-only and decline revoke advertising permission. Withdrawal stops future event sending; already transmitted information remains governed by Meta policies.
- Explicit advertising permission loads the vendor Pixel script, initializes only this ID with autoConfig disabled and sends PageView. A valid saved `RH-YYYYMMDD-12HEX` reference triggers Lead, deduplicated by reference in the page runtime. Failed saves, invalid fields, form opening and WhatsApp clicks do not trigger Lead. The opaque reference is used only as eventID; no form fields, price/value or booking outcome is passed.
- Automatic advanced matching is off in Meta. Automatic events are unchecked in setup. Do not enable either without review of the actual data sharing.
- Vendor Meta processing can include page URLs/referrers, browser/network details and cookie identifiers. First-party campaign sanitisation does not claim to sanitise Meta's own vendor network requests.
- No tracking failure may prevent a website enquiry from completing. Browser blocking and consent refusal create reporting gaps; this cannot record every visitor or every ad click.
- Automated tests use queued vendor commands and a local Worker/SQLite test enquiry; they never send personal test leads to Meta or the production enquiry database.

## Proposed first campaign (owner approved setup; launch remains paused)

UK only, Instagram and Facebook; Leads → Website → Lead; highest-volume bidding; one ad set and two creative variants. Lifetime media budget INR 10,000 for 14 days, plus applicable billing taxes. Set start/end only at launch so setup time cannot consume the campaign window. No giveaway. Destination and approved parameter template above. No ads have been launched by this code release. Assess reachable, qualified enquiries, quotes, bookings and contribution after advertising costs; no CPL or booking volume is guaranteed.
