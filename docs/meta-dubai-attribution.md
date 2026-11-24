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
