import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {transform} from 'esbuild';
import {SEARCH_LOADER_SOURCE} from './runtime-search.mjs';
import {readFile} from 'node:fs/promises';

const supplierDomain = /(?:raynatours|raynab2b)\.com/i;
const supplierAuditFields = new Set(['supplierProductId', 'sourceAmount', 'sourceTitle', 'hotelSourceUrl', 'hotelSourceCheckedOn']);

export function publicCatalogueData(value) {
  if (Array.isArray(value)) return value
    .filter(item => !(item && typeof item.url === 'string' && supplierDomain.test(item.url)))
    .map(publicCatalogueData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, data]) => !supplierAuditFields.has(key)
      && !(key === 'source' && typeof data === 'string' && supplierDomain.test(data)))
    .map(([key, data]) => [key, publicCatalogueData(data)]));
}

// Keep the authoring preview intact. Only the published assets are optimized.
// Top-level names must survive: static HTML uses inline event handlers.
export async function compileSiteAssets(source, appScript, catalogue) {
  const styles = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!styles) throw new Error('Missing shared stylesheet');
  const auditStart = appScript.indexOf('const MEDIA_SOURCES = {');
  const auditEnd = appScript.indexOf('// Images whose licence requires visible attribution', auditStart);
  if (auditStart < 0 || auditEnd < 0 || /\bMEDIA_SOURCES\b/.test(appScript.slice(auditEnd).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''))) {
    throw new Error('Media audit table boundary or runtime dependencies changed');
  }
  // Full source/rights records stay in source control; visible licence credits stay in the app.
  const originalRuntime = appScript.slice(0, auditStart) + appScript.slice(auditEnd);
  if (!catalogue?.tours?.length || !catalogue.searchOther) throw new Error('Missing final catalogue snapshot');
  const dataStart = originalRuntime.indexOf('const TOURS = [');
  const dataEnd = originalRuntime.indexOf('const TOUR_CATS = [', dataStart);
  const addon = originalRuntime.slice(dataStart, dataEnd).match(/^const VISA_ADDONS = .*;$/m)?.[0];
  if (dataStart < 0 || dataEnd < 0 || !addon) throw new Error('Catalogue declaration boundaries changed');
  // Lists retain card/filter facts. Long detail copy belongs to its activity page and the
  // complete full-text search index loads on demand. Authoring/prerender stays unchanged.
  let runtime = originalRuntime.slice(0, dataStart) +
    'const TOURS = window.RAAHHI_CATALOGUE.tours.map(t=>Object.assign({},t,window.RAAHHI_CATALOGUE.detail?.[t.id]||{}));\n' +
    addon + '\n' + originalRuntime.slice(dataEnd);
  // Activity prices already travel in the shared catalogue. Do not ship a second
  // copy of their source/rate metadata in the runtime price registry.
  const priceDeclaration = runtime.match(/^const PRICE_CATALOGUE = (.*);$/m);
  if(!priceDeclaration) throw new Error('Missing central price registry');
  const activityIds = new Set(catalogue.tours.map(t=>t.id));
  const otherPrices = Object.fromEntries(Object.entries(JSON.parse(priceDeclaration[1])).filter(([id])=>!activityIds.has(id)));
  runtime = runtime.replace(priceDeclaration[0], 'const PRICE_CATALOGUE = '+JSON.stringify(publicCatalogueData(otherPrices))+';');
  // Public option details belong in the activity detail chunk, not on every catalogue visit.
  const optionDeclaration = runtime.match(/^const PRODUCT_OPTION_CATALOGUE = (.*);$/m);
  if(!optionDeclaration) throw new Error('Missing checked product option register');
  const otherOptions = Object.fromEntries(Object.entries(JSON.parse(optionDeclaration[1])).filter(([id])=>!activityIds.has(id)));
  runtime = runtime.replace(optionDeclaration[0], ()=>'const PRODUCT_OPTION_CATALOGUE = '+JSON.stringify(publicCatalogueData(otherOptions))+';');
  const summaryStart = 'function activitySummaryText(record){';
  const searchOther = 'other:[t.desc,t.description,t.duration,t.timing,t.location,t.pickup,...(t.inclusions||[])].filter(hasRealValue).map(normalizeSearch)';
  if (!runtime.includes(summaryStart) || !runtime.includes(searchOther)) throw new Error('Catalogue summary/search integration changed');
  runtime = runtime.replace(summaryStart, summaryStart + '\n  if(record._cardSummary) return record._cardSummary;')
    .replace(searchOther, 'other:[]');
  const globalSearchStart = '  const q = normalizeSearch(query);\n  if(q !== globalSearchQuery)';
  const tourSearchStart = '  const q = document.getElementById("tourSearch")?.value || "";';
  const openSearchStart = 'function openSearch(){';
  const searchDeclarations = 'let globalSearchQuery = "", globalSearchLimits = {};';
  for(const marker of [globalSearchStart, tourSearchStart, openSearchStart, searchDeclarations]){
    if(!runtime.includes(marker)) throw new Error('Search-loading integration changed');
  }
  runtime = runtime.replace(searchDeclarations, SEARCH_LOADER_SOURCE + '\n' + searchDeclarations)
    .replace(openSearchStart, openSearchStart + '\n  loadActivitySearch().catch(()=>{});')
    .replace(globalSearchStart, `  const q = normalizeSearch(query);
  if(q && !window.RAAHHI_CATALOGUE.searchReady){
    box.innerHTML = '<p class="gs-hint">Loading matching results…</p>';
    status.textContent = "Searching…";
    loadActivitySearch().then(()=>globalSearch(document.getElementById("globalSearch").value)).catch(()=>{
      box.innerHTML = '<p class="gs-hint">Search could not load. Try again or use the navigation links.</p>';
      status.textContent = "Search temporarily unavailable.";
    });
    return;
  }
  if(q !== globalSearchQuery)`)
    .replace(tourSearchStart, tourSearchStart + `
  if(normalizeSearch(q) && !window.RAAHHI_CATALOGUE.searchReady){
    document.getElementById("tourResultsCount").textContent = "Searching activities…";
    loadActivitySearch().then(()=>renderTours()).catch(()=>{
      document.getElementById("tourResultsCount").textContent = "Search could not load. Try again or browse by category.";
    });
    return;
  }`);
  // The package listing contains JSON source arrays embedded in an otherwise JavaScript catalogue.
  runtime = runtime.replace(/("sources"\s*:\s*)(\[\s*\{[^\[\]]*\}\s*\])/g, (full, key, list) =>
    supplierDomain.test(list) ? key + JSON.stringify(publicCatalogueData(JSON.parse(list))) : full);
  const accommodation = runtime.match(/const PACKAGE_ACCOMMODATION_OVERRIDES = (\{[\s\S]*?\n\});/);
  if (!accommodation) throw new Error('Missing package accommodation registry');
  runtime = runtime.replace(accommodation[0], () =>
    'const PACKAGE_ACCOMMODATION_OVERRIDES = ' + JSON.stringify(publicCatalogueData(JSON.parse(accommodation[1]))) + ';');
  const enquiryPayload = '  const payload={enquiryVersion:2,category:rows[0][1],kind,...identity,product:product||"",page:page.href,details};';
  if (!runtime.includes(enquiryPayload)) throw new Error('Enquiry attribution integration point changed');
  runtime = runtime.replace(enquiryPayload, '  details.push(...(window.raahhiCampaign?.details()||[]));\n' + enquiryPayload);
  runtime += '\n' + await readFile(new URL('./campaign-attribution.js',import.meta.url),'utf8');
  runtime += '\n' + await readFile(new URL('./meta-pixel.js',import.meta.url),'utf8');
  runtime += '\n' + await readFile(new URL('./visitor-runtime.js',import.meta.url),'utf8');
  const [js, css] = await Promise.all([
    transform(runtime, {loader:'js', target:'es2020', minifyWhitespace:true, minifySyntax:true, minifyIdentifiers:false, legalComments:'none'}),
    transform(styles[1], {loader:'css', minify:true, legalComments:'none'})
  ]);
  const files = new Map();
  function asset(name, extension, content) {
    if (extension === 'js' && (supplierDomain.test(content) || /\bRayna Tours\b/i.test(content))) {
      throw new Error('Supplier evidence in published script: ' + name);
    }
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const path = `/assets/${name}.${hash}.${extension}`;
    files.set(path, buffer);
    return path;
  }
  const scriptUrl = asset('app', 'js', js.code);
  const styleUrl = asset('site', 'css', css.code);
  const detailKeys = ['description', 'faqs', 'importantInformation', 'exclusions', 'cancellationPolicy', 'sources',
    'highlights', 'restrictions', 'itinerary', 'pickup', 'meetingPoint', 'inclusions', 'location', 'timing', 'optionConfig'];
  const detailUrls = new Map();
  const detailSizes = [];
  const tours = catalogue.tours.map(t => {
    const compact = publicCatalogueData(t), detail = {};
    for (const key of detailKeys) {
      if (Object.hasOwn(compact, key)) { detail[key] = compact[key]; delete compact[key]; }
    }
    if (Object.keys(detail).length) {
      const content = 'window.RAAHHI_CATALOGUE.detail=' + JSON.stringify({[t.id]:detail}) + ';';
      detailUrls.set(t.id, asset('activity-' + t.id, 'js', content));
      detailSizes.push({bytes:Buffer.byteLength(content), gzipBytes:gzipSync(content).length});
    }
    return compact;
  });
  const searchContent = 'window.RAAHHI_SEARCH_OTHER=' + JSON.stringify(catalogue.searchOther) + ';';
  const searchUrl = asset('search', 'js', searchContent);
  const catalogueContent = 'window.RAAHHI_CATALOGUE=' + JSON.stringify({tours, searchUrl, searchReady:false}) + ';';
  const catalogueUrl = asset('catalogue', 'js', catalogueContent);
  const images = new Map();
  for (const match of source.matchAll(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)(?=")/g)) {
    if (!images.has(match[0])) images.set(match[0], asset('brand', match[1] === 'jpeg' ? 'jpg' : 'png', Buffer.from(match[2].replace(/\s/g,''), 'base64')));
  }
  function attach(html, bootstrap, activityId) {
    html = html.replace('No advertising tracker or payment processor is connected.', 'No payment processor is connected. Meta advertising tracking is optional and disabled until you choose Allow analytics & ads. With that permission, Meta receives page URLs, referrer and browser/network information, cookie identifiers and a Lead event after an enquiry is saved. We do not deliberately send enquiry names, contact details, nationality, messages or other form field values to Meta. Automatic advanced matching and automatic event detection are not enabled. Meta may process this information for advertising measurement and personalisation. Advertising choice is stored for up to 180 days, separately from first-party analytics permission. Use Analytics preferences in the footer to withdraw; choosing Allow analytics or Decline optional tracking stops future Meta event sending on this site. Existing information already received by Meta is governed by its policies. Browser privacy signals disable optional advertising. With optional analytics allowed, recognised campaign labels and numeric ad identifiers from our Dubai holiday promotion are retained in session storage for a 30-minute attribution window and can be included with an enquiry you submit, so our team can identify the campaign. Raw URL queries and Meta click identifiers are not retained for this attribution.');
    const detailUrl = detailUrls.get(activityId);
    const scripts = `<script data-catalogue src="${catalogueUrl}" defer></script>` +
      (detailUrl ? `<script data-activity-detail src="${detailUrl}" defer></script>` : '') +
      `<script id="appScript" src="${scriptUrl}" defer></script>`;
    let result = html.replace(/<style>[\s\S]*?<\/style>/, `<link rel="stylesheet" href="${styleUrl}">`)
      .replace('</head>', bootstrap + '</head>')
      .replace('<!--APP_SCRIPT-->', scripts);
    for (const [embedded, url] of images) result = result.split(embedded).join(url);
    if (/<style>|data:image\/(?:png|jpeg);base64/.test(result)) throw new Error('Repeated inline assets remain in output');
    return result;
  }
  const baseline = await transform(originalRuntime, {loader:'js', target:'es2020', minifyWhitespace:true, minifySyntax:true, minifyIdentifiers:false, legalComments:'none'});
  const initialBytes = Buffer.byteLength(js.code) + Buffer.byteLength(catalogueContent);
  const initialGzipBytes = gzipSync(js.code).length + gzipSync(catalogueContent).length;
  return {files, scriptUrl, styleUrl, catalogueUrl, attach, report:{
    originalScriptBytes:Buffer.byteLength(appScript), publishedScriptBytes:Buffer.byteLength(js.code),
    originalScriptGzipBytes:gzipSync(appScript).length, publishedScriptGzipBytes:gzipSync(js.code).length,
    previousSharedScriptBytes:Buffer.byteLength(baseline.code), previousSharedScriptGzipBytes:gzipSync(baseline.code).length,
    sharedCatalogueBytes:Buffer.byteLength(catalogueContent), sharedCatalogueGzipBytes:gzipSync(catalogueContent).length,
    onDemandSearchBytes:Buffer.byteLength(searchContent), onDemandSearchGzipBytes:gzipSync(searchContent).length,
    initialScriptBytes:initialBytes, initialScriptGzipBytes:initialGzipBytes,
    largestActivityInitialScriptBytes:initialBytes + Math.max(0, ...detailSizes.map(d=>d.bytes)),
    largestActivityInitialScriptGzipBytes:initialGzipBytes + Math.max(0, ...detailSizes.map(d=>d.gzipBytes)),
    activityDetailFiles:detailUrls.size,
    sharedStylesBytes:Buffer.byteLength(css.code), extractedBrandImages:images.size
  }};
}
