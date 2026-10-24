# RAAHHI TOURS

Production website source and GitHub Pages build for **https://raahhi.com**.

- Authoritative deployed baseline: `source/raahhi-tours52.html`.
- `build.mjs` prerenders the route manifest into clean static HTML paths for GitHub Pages.
- The build validates the production origin, absolute canonicals, Open Graph URLs, robots.txt and the 245-URL sitemap before deployment.
- The shared JavaScript is emitted once as `/assets/app.js` so every static route does not duplicate the full application payload.
- Product/catalogue facts remain in the authoritative HTML source; generated `dist/` output is not committed.

GitHub Pages must be enabled with **Settings → Pages → Source: GitHub Actions** before the deployment job can publish.

## Prices and display currencies

`PRICE_CATALOGUE` in the authoritative HTML is the central pricing register. Approved USD starting prices are exactly USD 2 below the recorded Rayna USD source amount (checked 25 October 2026). Product IDs, supplier source links, source amounts and pricing basis are recorded there. Supplier-unavailable offers and the unconfirmed fountain ticket option are reference prices without bookable Offer schema. Dubai Easter Short Break remains on enquiry until a current USD quote is confirmed. AquaFun retains its existing official-purchase-only flow.

The header selector supports AED, INR, USD, EUR, GBP, SAR, QAR, KWD, OMR, BHD, AUD, CAD, SGD, CNY, JPY, CHF, NZD and HKD. AED is the interactive default; static HTML and structured Offer prices use the canonical USD amounts. Conversions always start from the original USD cents and use currency-specific decimal precision. Selections persist locally where storage is available. Currency changes preserve forms, filters and open enquiries.

`scripts/update-exchange-rates.mjs` refreshes the saved `FX_RATES` constant from ExchangeRate-API's open USD endpoint. The Pages workflow runs daily at 02:23 UTC and on deployment. It validates all 18 currencies, saves successful updates to source control and retains the prior cache on failure. The site displays the provider update date, marks rates older than 72 hours as saved rates, and includes the required provider attribution. Browsers do not call the external rate service. These rates are indicative display conversions; final payment currency and fees are confirmed with the quote. This refresh does not reprice products or recheck Rayna availability.

Validation: `npm run build`, then `.github/check-pricing.mjs`, `.github/check-published-data.mjs`, `.github/check-search.mjs` and `.github/check-site-ui.mjs` with Node. The pricing check covers exact discounts, currency precision/persistence, enquiry integrity, reference/unknown prices, saved-rate fallback and narrow screens.
