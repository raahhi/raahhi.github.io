# Product option verification

Checked: 25 October 2026. All 235 existing products were mapped to their recorded Rayna source pages. The checked option registry is embedded as `PRODUCT_OPTION_CATALOGUE` in the authoritative HTML.

The check uses Rayna's public, signed-out product pages and the public option selector. Supplier option and transfer IDs are retained when exposed. Source options are queried with a recorded date and participant count. Where the initial date had no choices, a published alternative calendar date was checked; child-dependent entry was also checked with a child where relevant. A missing response is never taken to prove permanent closure.

The final register contains 594 selectable choices and 455 priced reference choices. Every numeric reference is exactly USD 2 below the corresponding checked USD quote. Reference dates and traveller basis are stored per choice, rather than being represented as universal prices or totals for arbitrary groups. Quoted prices expire from the option display after their recorded date. Existing product-level starting prices remain unchanged.

Cancellation conditions are associated with the specific supplier option. Package-level conditions are used for verified hotel preferences within that package. Public visa refund clauses are recorded separately; eligibility and the applicable visa option require the applicant's circumstances. A headline-only policy is marked as incomplete. Missing supplier information is recorded in `audit.json` and confirmed manually with the quote, without fabricated fees, deadlines or availability labels.

Hotel names are selectable only when matched to the freshly checked supplier package page. Other existing hotel examples remain in the original product information, and customers can request a category or describe an alternative for quotation. Selecting a hotel without a verified price or requesting a different category clears any assumption that the original starting price applies.

The audit contains product IDs, checked URLs/dates, choice counts and specific gaps. It contains no raw HTML, reviews, customer data, session cookies or authentication tokens. Source documents and pricing checks are evidence of published reference information, not a live inventory integration or a confirmed reservation.
