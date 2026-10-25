# RAAHHI TOURS

Production website source and GitHub Pages build for **https://raahhi.com**.

- Authoritative deployed baseline: `source/raahhi-tours52.html`.
- `build.mjs` prerenders the route manifest into clean static HTML paths for GitHub Pages.
- The build validates the production origin, absolute canonicals, Open Graph URLs, robots.txt and the 268-URL sitemap before deployment.
- The shared JavaScript is emitted once as `/assets/app.<hash>.js` so every static route does not duplicate the full application payload.
- Product/catalogue facts remain in the authoritative HTML source; generated `dist/` output is not committed.

GitHub Pages must be enabled with **Settings → Pages → Source: GitHub Actions** before the deployment job can publish.

## Prices and display currencies

`PRICE_CATALOGUE` in the authoritative HTML is the central pricing register. Approved USD starting prices are exactly USD 2 below the recorded Rayna USD source amount (checked 25 October 2026). Product IDs, supplier source links, source amounts and pricing basis are recorded there. Supplier-unavailable offers and the unconfirmed fountain ticket option are reference prices without bookable Offer schema. Dubai Easter Short Break remains on enquiry until a current USD quote is confirmed. AquaFun retains its existing official-purchase-only flow.

The header selector supports AED, INR, USD, EUR, GBP, SAR, QAR, KWD, OMR, BHD, AUD, CAD, SGD, CNY, JPY, CHF, NZD and HKD. AED is the interactive default; static HTML and structured Offer prices use the canonical USD amounts. Conversions always start from the original USD cents and use currency-specific decimal precision. Selections persist locally where storage is available. Currency changes preserve forms, filters and open enquiries.

`scripts/update-exchange-rates.mjs` refreshes the saved `FX_RATES` constant from ExchangeRate-API's open USD endpoint. The Pages workflow runs daily at 02:23 UTC and on deployment. It validates all 18 currencies, saves successful updates to source control and retains the prior cache on failure. The site displays the provider update date, marks rates older than 72 hours as saved rates, and includes the required provider attribution. Browsers do not call the external rate service. These rates are indicative display conversions; final payment currency and fees are confirmed with the quote. This refresh does not reprice products or recheck Rayna availability.

Validation: `npm run build`, then `.github/check-pricing.mjs`, `.github/check-published-data.mjs`, `.github/check-search.mjs` and `.github/check-site-ui.mjs` with Node. The pricing check covers exact discounts, currency precision/persistence, enquiry integrity, reference/unknown prices, saved-rate fallback and narrow screens.

## Product options, supplier cancellation terms and detailed enquiries

`PRODUCT_OPTION_CATALOGUE` maps all 235 products to their checked Rayna source. The 25 October 2026 check identified 594 selectable transfer/ticket/hotel preferences, including 455 USD reference quotes. Numeric option quotes record the exact date and participant basis used for the supplier check, and deduct exactly USD 2 from that matching source quote. They remain reference prices, never a calculated total for a different date or group. An expired dated quote falls back to price confirmation on enquiry. Unpriced hotel preferences and category upgrade requests do not inherit the base package price.

Each option has a stable local ID, supplier option/transfer IDs where applicable, source URL, verification date, inclusions, exclusions and policy reference. Cancellation conditions come from the matching Rayna option or package. Where only a headline condition is public, the page distinguishes it from full conditions to be confirmed in the quote. Unverified or date-dependent information is not invented. Rayna's general cancellation/no-show conditions are linked separately. Products with no options returned for the checked dates remain available for manual enquiries; visa service options depend on nationality and residence. AquaFun retains its official-only flow.

Activity option evidence is emitted only in the relevant activity detail chunk. Visitors do not call Rayna's APIs. Currency changes keep the selected option, form values and cancellation information intact. The selected option, price basis, dated quote context, inclusions and cancellation conditions are included in the prepared enquiry summary.

Holiday enquiries collect dates or flexibility, adults, children and child ages, rooms, hotel/category preferences, transfers, arrival details, meals and optional assistance needs. Visa enquiries require nationality, residence, purpose and applicant count, plus a date or an explicit flexible-date selection. Both remain local summary preparation; no enquiry, payment or passport document is transmitted by these forms.

`source/verification/product-options/audit.json` records coverage and remaining source gaps without storing anonymous session credentials or raw source pages. `.github/check-options.mjs` verifies catalogue coverage, discount arithmetic, policy consistency, option switching, unpriced preferences, field validation, safe summaries, currency preservation and mobile widths. It runs with the existing deployment checks.

## Search readiness and human enquiries (25 October 2026)

The public brand is RAAHHI TOURS, operated by Raahi Tourism PVT LTD. Verified customer channels, support hours and office details are recorded in the authoring source. Enquiry forms prepare a summary and expose explicit WhatsApp/email handoffs; customers review and press Send in the chosen app. There is no automated delivery claim or backend. Cancellation policies share the same product-option records across detail pages, FAQs and comparisons. Eight priority visa pages include scoped official-source guidance. Two additional planning guides bring the sitemap to 270 routes. Fonts are served from `source/fonts` with their licences.

Implementation evidence and owner-verification steps: `source/verification/search-readiness/`. Run `node .github/check-readiness.mjs` after building. Existing starting prices and photographs are preserved. External profiles, actual indexing, real customer receipt and field performance require separate evidence.
