# Optimized catalogue photos

The manifest maps existing, rights-recorded catalogue URLs to same-host WebP files. Original source URLs remain the keys for alt text, image positioning and visible licence credits. Files are resized and converted; the bitmap is not cropped. Product galleries fill responsive frames with CSS cover cropping. Existing focal points are preserved, with detail-only adjustments for the Museum of the Future and a taller desktop frame for Sky Views Observatory. Original image files and catalogue photo order are unchanged; CSS framing does not crop the stored bitmap.

| Product | Photographer | Licence | Source |
| --- | --- | --- | --- |
| IMG Worlds of Adventure | Jeremy Thompson | [CC-BY-2.0](https://creativecommons.org/licenses/by/2.0/) | [Source photo](https://commons.wikimedia.org/wiki/File:Velociraptor_(IMG_Worlds_of_Adventure)_1.jpg) |
| IMG Worlds of Adventure | Jeremy Thompson | [CC-BY-2.0](https://creativecommons.org/licenses/by/2.0/) | [Source photo](https://commons.wikimedia.org/wiki/File:Predator_(IMG_Worlds_of_Adventure)_1.jpg) |
| Luxury Yacht Rental Dubai | AJ Ahamad | [PL](https://www.pexels.com/license/) | [Source photo](https://www.pexels.com/photo/30047576/) |
| Luxury Yacht Rental Dubai | Denys Gromov | [PL](https://www.pexels.com/license/) | [Source photo](https://www.pexels.com/photo/luxury-yacht-in-dubai-marina-at-twilight-36070167/) |

Each photo has a smaller and a larger variant. Filenames include content hashes. Dimensions and byte counts are recorded in manifest.json and checked during the build.

The yacht photos illustrate yachts in Dubai Marina, rather than a confirmed supplier vessel. A visible gallery caption explains that the booked vessel is confirmed on enquiry.

The source catalogue retains the original media audit. Photos marked as representative substitutes are excluded from activity and package image arrays by ILLUSTRATIVE_PRODUCT_PHOTOS. Listings without an exact approved photograph use the existing RAAHHI title panel.

## Approved additions, 1 October 2026

| Listings | Photographer | Licence | Source |
| --- | --- | --- | --- |
| sky-views-observatory | Fabien BELLANGER | [Unsplash License](https://unsplash.com/license) | [Source photo](https://unsplash.com/photos/burj-khalifa-skyline-in-dubai-WyfXOHgI49s) |
| al-ain-adventure | Anaskmohamed | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [Source photo](https://commons.wikimedia.org/wiki/File:Al_Ain_Adventure_Rafting.jpg) |
| lotus-mega-yacht-brunch-cruise, lotus-mega-yacht-dinner-cruise, lotus-mega-yacht-sunset-cruise | Dina | [Pexels License](https://www.pexels.com/license/) | [Source photo](https://www.pexels.com/photo/aerial-view-of-the-lotus-mega-yacht-in-the-harbor-in-dubai-uae-19960510/) |

The added files are resized without cropping. Source licences also apply to the converted copies, including CC BY-SA 4.0 for Al Ain Adventure. Visible attribution and context appear beneath the product gallery. approved-photos.json records exact source URLs, reuse terms, checking date and affected listings. The Lotus photograph is shared across four listings that explicitly name the same vessel. The New Year’s Eve gallery identifies Lotus as one option and states that other vessels are not pictured.

photo-requests.csv tracks the 55 unresolved activity photos. It records reference sites, required subject matter and permission requirements without assuming that a public website grants reuse rights.

## Image availability pass, 2 October 2026

Two exact-location Unsplash photographs fill the Dubai Balloon and Burj Al Arab dining gaps. Their captions distinguish the photographed scene from the selected booking option. Seven existing Wikimedia photographs now have same-host WebP variants; `cached-photo-sources.json` records provenance and original licences. Original gallery URLs and order are preserved. The remaining 53 products are tracked in `photo-requests.csv`; no unrelated replacement or supplier image has been introduced.

The next sequential batch caches ten additional existing Wikimedia photos previously loaded through Special:Redirect links. Catalogue keys, gallery order, alt text, focal points and attribution remain intact. Downloaded copies retain transparency where present and are converted without bitmap cropping.

The final technical batch downloads 28 original photographs plus four CC0 photographs. All 63 previously rate-limited URL variants are mapped to local copies of their 49 existing source photographs. The 53 unassigned products remain separate and their targeted licensed-photo search outcomes are recorded in `photo-requests.csv`. A licensed Abu Dhabi quad-biking candidate could not be downloaded (HTTP 403), so no unverified replacement is published.

The last two remaining Wikimedia gallery photographs (wakeboarding and dune buggy) are also served locally. The wakeboarding copy is kept at its native 467px width; no upscaling, subject replacement or bitmap crop is introduced.


Sixteen shortlisted photos now fill 23 previously empty activity galleries. Fifteen source photographs and one reuse of the approved Sky Views image are mapped in `substitute-photos.json`, with licence records and representative captions. Existing gallery photographs and ordering remain unchanged. Local WebP variants preserve the full image; the new galleries and cards use a decorative blurred background fill to avoid clipping portrait subjects. These are illustrative experiences, not verified operator vehicles or named venues. `photo-requests.csv` now tracks 30 unresolved galleries; optional exact-venue follow-ups for the 23 filled galleries are retained in `representative-photo-followups.csv`.

Four more downloaded and visually checked Unsplash photographs fill the LEGOLAND Water Park, Donut Ride, Abu Dhabi helicopter and Deep Sea Cruising galleries. Captions identify representative scenes and distinguish other locations and unconfirmed equipment. All original images remain intact. Local 640px and 1600px WebP variants preserve full frames. The unresolved request list now contains 26 products.


Nine user-supplied originals are implemented across ten activity pages, including both KidZania locations and a higher-resolution copy of the existing Donut Ride photograph. Originals and all previous media files remain unchanged. Responsive WebP copies retain the full frame without upscaling. Captions identify representative venues, vehicles and vessels. The iFLY Hollywood photograph retains visible © BrokenSphere / Wikimedia Commons attribution and CC BY-SA 3.0 terms, also applicable to converted copies. The unresolved photo request list now contains 17 products.
