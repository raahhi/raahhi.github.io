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

The Dubai pilot adds `/dubai/`, `/activities/dubai/categories/desert-safaris/` and `/activities/dubai/categories/cruises/`, increasing the registered inventory to 274. Existing paths remain unchanged. The planning hub is linked from the homepage and relevant Dubai pages; city categories link to the country category and every mapped product, whose primary breadcrumbs link back. Remaining expansion candidates follow below.

| Proposed role/path | Owns | Links |
|---|---|---|
| `/uae/` | Multi-emirate planning and country overview | City planning hubs, activities, holidays, UAE visa and emirate guide. |
| `/dubai/` (pilot) | Connect stay length, activity choices, hotel/transfer arrangements and entry checks | Dubai services, city categories and relevant guides. |
| `/abu-dhabi/`, `/ras-al-khaimah/` | Their own local planning | Their services and genuinely relevant guides/day trips. |
| `/activities/dubai/categories/desert-safaris/` (pilot) | Choosing a Dubai safari | All mapped products, Dubai list, UAE safari category and safari guide. |
| `/activities/dubai/categories/cruises/` (pilot) | Choosing a Dubai cruise or yacht outing | All mapped products, Dubai list, UAE cruise category and dinner-cruise comparison. |
| `/attractions/dubai/burj-khalifa/` | Ticket-tier/combination choice and visit facts | Mapped products, Dubai list, deck comparison and nearby attractions. |
| `/guides/` and useful destination guide hubs | Editorial discovery | Existing guides and matched commercial pages. |

Finalize proposed paths before first publication, then append and freeze them. No empty service shells, duplicated country gateway, price-filter SEO pages or category clones. New category/attraction pages require distinct intent, useful current inventory, specific content, inbound/outbound links and an owner. No arbitrary product-count threshold guarantees indexing.

## Questions and breadcrumbs

City planning hubs own general destination planning. City activity lists own activity discovery. Categories own choosing among a type of experience. Attraction hubs own visit facts and ticket comparisons. Products own exact option/pickup/policy details. Guides own longer planning answers. Company FAQs own company-wide process questions.

Avoid identical full FAQ blocks on several layers. Short linked summaries are allowed. Keep product FAQs focused rather than combining every reusable question. A country-wide essentials owner must be chosen explicitly; substantive visa eligibility remains on the visa page.

Primary categories determine a consistent breadcrumb, regardless of the referring page. Every distinct ancestor must exist and be linked, with matching BreadcrumbList. Do not add two breadcrumb labels pointing to the same current `/activities/` gateway. Preserve direct discovery shortcuts so richer hierarchy does not make products deeper than three clicks.

## Next implementation gates

1. Implement serving-layer lifecycle and alias handling before retiring any current path.
2. Add stable catalogue identities independent of display labels and normalize route lookup where needed.
3. Pilot Dubai planning/category/attraction pages with distinct intent and complete links.
4. Reduce repeated listing controls and FAQ duplication; implement real retrievable pagination before linking page numbers.
5. Extend proven local content and connections to Abu Dhabi, RAK and country-level discovery.

Retain private application authentication and existing enquiry behavior. These URL checks never submit a customer enquiry or send a message.
