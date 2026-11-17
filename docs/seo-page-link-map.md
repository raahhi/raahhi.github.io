# Published URLs and page responsibilities

Baseline recorded 18 November 2026: 271 public canonical pages. This is an observation date, not their publication or last-fact-check date.

## Release contract

`source/published-urls.json` records immutable page identities, paths and kinds. Every production build checks the previous register from Git history, then checks every rendered page and internal anchor before output can deploy. Append a new record only when its content and route are ready. Do not edit or remove an existing identity/path to reorganize navigation. An existing product name/category edit must either preserve its path or fail the build.

This first release supports live records. Retirement is deliberately blocked until relevant redirects/410 responses, alias history and same-release link/sitemap updates are implemented at the serving layer. A static redirect page or JavaScript navigation must never be described as an HTTP redirect.

The guard verifies complete route coverage, canonical/robots/sitemap agreement, real internal targets, fragment IDs, clean internal hrefs, no internal nofollow/new-tab links, inbound links and a maximum homepage depth of three. `build-report.json.publishedURLAudit` reports the results. A registry entry is not proof of Google indexing.

## Current inventory and intended additions

| Role | Existing path | Responsibility | Planned addition or connection |
|---|---|---|---|
| Activities gateway | `/activities/` | UAE activity discovery | Keep as the UAE service/country gateway; avoid a duplicate country list. |
| City activity list | `/activities/{city}/` | Browse the city's actual products | Add city category and attraction shortcuts plus planning-hub link. |
| Country category | `/activities/categories/{category}/` | Compare the category across UAE destinations | Retain all current paths; link to qualifying city categories. |
| Activity | `/activities/{city}/{record-id}/` | Exact experience, options, pickup, restrictions and enquiry | Primary category breadcrumb, mapped category chips, matched alternatives. |
| Holidays | `/holidays/`, `/holidays/{city}/` | Compare actual multi-day packages | Connect planning hubs and helpful guides; retain current paths. |
| Package | `/holidays/{city}/{record-id}/` | Specific base-city itinerary and quote | Link relevant itinerary activities without implying optional extras are included. |
| Visa | `/visas/{destination}/` | Entry-route/assistance information | Keep destination ownership; do not mass-generate nationality/type pages. |
| Guide | `/guides/{slug}/` | One editorial question and a clear next action | Preserve every current guide path; add useful guide discovery hubs gradually. |
| Comparison | `/compare/{slug}/` | Decide among distinct options | Clarify browse-versus-comparison intent, especially UAE water parks. |
| Company | Current about/contact/FAQ/policy paths | Identity, help and accurate terms | Remain connected to commercial journeys. |

The Dubai pilot adds `/dubai/` and city categories for desert safaris, cruises, theme parks and water parks at `/activities/dubai/categories/{slug}/`, increasing the registered inventory to 276. All original 271 paths and the first three pilot paths remain unchanged. The theme-park page explicitly covers the catalogue's indoor play, skating, snow and entertainment inventory as well as large parks; the water-park page distinguishes conventional parks from AquaFun's official-only inflatable-water-play listing. The planning hub is linked from the homepage and relevant Dubai pages; city categories link to the country category and every mapped product, whose primary breadcrumbs link back. Remaining expansion candidates follow below.

| Proposed role/path | Owns | Links |
|---|---|---|
| `/uae/` | Multi-emirate planning and country overview | City planning hubs, activities, holidays, UAE visa and emirate guide. |
| `/dubai/` (pilot) | Connect stay length, activity choices, hotel/transfer arrangements and entry checks | Dubai services, city categories and relevant guides. |
| `/abu-dhabi/`, `/ras-al-khaimah/` | Their own local planning | Their services and genuinely relevant guides/day trips. |
| `/activities/dubai/categories/desert-safaris/` (pilot) | Choosing a Dubai safari | All mapped products, Dubai list, UAE safari category and safari guide. |
| `/activities/dubai/categories/cruises/` (pilot) | Choosing a Dubai cruise or yacht outing | All mapped products, Dubai list, UAE cruise category and dinner-cruise comparison. |
| `/activities/dubai/categories/theme-parks/` (published) | Choosing a Dubai park day, pass or indoor entertainment session | All mapped products grouped by outing, Dubai family guide, water-park category and country category. |
| `/activities/dubai/categories/water-parks/` (published) | Browsing Dubai ride parks versus inflatable water play | All mapped Dubai products, official-only route, country category and UAE decision comparison. |
| `/attractions/dubai/burj-khalifa/` | Ticket-tier/combination choice and visit facts | Mapped products, Dubai list, deck comparison and nearby attractions. |
| `/guides/` and useful destination guide hubs | Editorial discovery | Existing guides and matched commercial pages. |

Finalize proposed paths before first publication, then append and freeze them. No empty service shells, duplicated country gateway, price-filter SEO pages or category clones. New category/attraction pages require distinct intent, useful current inventory, specific content, inbound/outbound links and an owner. No arbitrary product-count threshold guarantees indexing.

## Questions and breadcrumbs

City planning hubs own general destination planning. City activity lists own activity discovery. Categories own choosing among a type of experience. Attraction hubs own visit facts and ticket comparisons. Products own exact option/pickup/policy details. Guides own longer planning answers. Company FAQs own company-wide process questions.

Avoid identical full FAQ blocks on several layers. Short linked summaries are allowed. Keep product FAQs focused rather than combining every reusable question. A country-wide essentials owner must be chosen explicitly; substantive visa eligibility remains on the visa page.

Activity and holiday product FAQs now preserve authored booking questions and fill only relevant gaps for eligibility, options, pickup, terms, seasonal status and package accommodation/customisation. They do not append the general price, enquiry or destination-browsing bank. The visible selection has at most eight questions, with fewer where the record needs fewer; a future record with more than eight authored questions must receive editorial review instead of silently losing answers. Full fact sections remain authoritative. AquaFun keeps the official-only booking answer. Country categories retain their inventory/geography FAQ, with shared availability and inclusion-process answers owned by `/faq/` and linked from each category. Native accordions keep all selected answers in the static HTML.

Burj Khalifa currently has one independently bookable activity record, with ticket levels handled as product options. A separate attraction URL is deferred until it adds a distinct, source-verified planning or combination-choice task; do not clone that product merely to fill a hierarchy. Sky Views has separate Observatory and Edge Walk records and is a candidate for the next source-verified attraction pilot.

Primary categories determine a consistent breadcrumb, regardless of the referring page. Every distinct ancestor must exist and be linked, with matching BreadcrumbList. Do not add two breadcrumb labels pointing to the same current `/activities/` gateway. Preserve direct discovery shortcuts so richer hierarchy does not make products deeper than three clicks.

## Next implementation gates

1. Implement serving-layer lifecycle and alias handling before retiring any current path.
2. Add stable catalogue identities independent of display labels and normalize route lookup where needed.
3. Pilot Dubai planning/category/attraction pages with distinct intent and complete links.
4. Reduce repeated listing controls and FAQ duplication; implement real retrievable pagination before linking page numbers.
5. Extend proven local content and connections to Abu Dhabi, RAK and country-level discovery.

Retain private application authentication and existing enquiry behavior. These URL checks never submit a customer enquiry or send a message.
