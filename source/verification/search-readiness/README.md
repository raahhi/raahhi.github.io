# Search readiness implementation — 25 October 2026

This release follows the 69/100 read-only audit. The score is an editorial assessment, not a Google ranking or AI citation metric. Changes are deployed through GitHub Pages using free services.

## Implemented

- Owner-confirmed public brand, legal entity, Pune office, customer email, phone/WhatsApp and support hours; Organization markup and company pages agree.
- Explicit customer-controlled WhatsApp and email handoffs for activity, holiday, general-contact and visa enquiries. The customer reviews and presses Send in the selected app. No backend, paid messaging API, fake delivery receipt or automatic data submission was introduced.
- Original RAAHHI terms/privacy wording. Recorded product cancellation charges and thresholds preserved in professional wording; the sister-company relationship is not published. The source-to-published policy wording map is evidence, not public runtime data.
- Shared option-aware cancellation rendering for product pages, FAQs and comparisons. Requested unpriced hotel categories require their own terms. Selected dated references do not leave a stale base Offer in JSON-LD; hydration restores the current route before metadata refresh.
- Incorrect indoor/outdoor guide classifications corrected. Six owner-prioritized activities and four visa shortcuts featured without unsupported best-seller claims.
- Scoped official-source guidance for eight priority visa destinations, reviewed on 25 October 2026. The remaining destinations keep official links and practical enquiry preparation, without claiming their nationality-specific facts have been verified. See visa-guidance.json.
- Two original Dubai planning guides and visible organizational editorial responsibility, correction contact and review scope.
- Same-origin WOFF2 fonts, retaining font families, subsets and SIL Open Font Licenses; external Google Fonts connections removed.
- New regression checks across 270 routes for identity, metadata, policy parity, option/schema alignment, handoff content and mobile layouts. Tests never send customer messages.

## Preserved

All 235 existing products, their numeric starting prices, USD 2 source discounts, 18 currencies and existing photos. There are two additional guide routes, making 270 sitemap URLs. No advertising, analytics vendor, paid service or fabricated reviews/profile links were added.

## External evidence still needed

- A real customer or owner must verify WhatsApp/email receipt by sending a message; automated checks validate the destination and prefilled content only.
- Search Console, Bing Webmaster, real crawler logs, backlink evidence and AI referral data are not established by website code. The connected GSC Wizard account previously refused reads because it has no active plan; do not retry or purchase a plan under the free-only instruction. Direct owner-access Search Console is free.
- Google Business Profile and other business accounts require genuine eligibility, account access and owner verification. No profiles, review history, staff credentials or visits have been invented.
- PageSpeed API previously returned a shared-project quota error; a public UI report was requested separately. No field Core Web Vitals or speed score is claimed without a completed result.
- Ongoing supplier price/fact review remains distinct from the existing daily exchange-rate cache update. No supplier live-inventory integration was introduced.

Run `npm run build`, the existing .github/check-*.mjs scripts and .github/check-readiness.mjs before deployment. Optional screenshots: set RAAHHI_READINESS_SHOTS to a local directory.
