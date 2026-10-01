import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile('dist' + (path.endsWith('/') ? path + 'index.html' : path)));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
try {
  const author = await browser.newPage();
  await author.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await author.goto('file://' + process.cwd() + '/source/raahhi-tours52.html');
  const expected = await author.evaluate(() => ({
    tours: TOURS,
    summaries: TOURS.map(t => activitySummaryText(t)),
    images: [...TOURS, ...PACKAGES, ...VISAS].map(x => x.images),
    search: GLOBAL_SEARCH_INDEX.map(({t, p, v, ...entry}) => entry)
  }));
  await author.close();
  const routes = [
    ['/', null], ['/activities/dubai/', null],
    ['/activities/dubai/evening-desert-safari/', 'evening-desert-safari'],
    ['/activities/dubai/sky-views-observatory/', 'sky-views-observatory'],
    ['/holidays/dubai/dubai-grand-stopover/', null], ['/visas/united-arab-emirates/', null]
  ];
  for (const [route, activityId] of routes) {
    const page = await browser.newPage({viewport:{width:390, height:900}}), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await page.goto(base + route);
    assert(!requests.some(p => /^\/assets\/search\./.test(p)), 'Search is not downloaded on page load');
    const details = requests.filter(p => /^\/assets\/activity-/.test(p));
    assert.equal(details.length, activityId ? 1 : 0, 'Only the current activity detail chunk loads');
    if(activityId) assert(details[0].includes('activity-' + activityId + '.'));
    const state = await page.evaluate(id => ({
      summaries:TOURS.map(t => activitySummaryText(t)),
      images:[...TOURS, ...PACKAGES, ...VISAS].map(x => x.images),
      current:id ? Object.fromEntries(Object.entries(TOURS.find(t=>t.id===id)).filter(([k])=>k!=='_cardSummary')) : null
    }), activityId);
    assert.deepEqual(state.summaries, expected.summaries, 'Every card summary stays identical');
    assert.deepEqual(state.images, expected.images, 'Every image list stays identical');
    if(activityId) assert.deepEqual(state.current, expected.tours.find(t=>t.id===activityId), 'Complete current record retained');

    if(route === '/') {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/assets/search.*.js', async r => { await gate; await r.continue(); });
      await page.evaluate(()=>{ openSearch(); setGlobalSearch('waterparks'); });
      assert.equal(await page.locator('#globalSearchStatus').textContent(), 'Searching…');
      release();
      await page.waitForFunction(()=>window.RAAHHI_CATALOGUE.searchReady);
      await page.waitForFunction(()=>document.querySelector('#globalSearchStatus').textContent !== 'Searching…');
      assert(await page.locator('#globalSearchResults a[href="/activities/categories/water-parks/"]').count());
    } else await page.evaluate(()=>loadActivitySearch());
    const search = await page.evaluate(()=>GLOBAL_SEARCH_INDEX.map(({t,p,v,...entry})=>entry));
    assert.deepEqual(search, expected.search, 'Full search/ranking inputs stay identical');
    if(route === '/activities/dubai/') {
      await page.locator('#tourSearch').fill('waterparks');
      assert(await page.locator('#tourGrid .product-card').count(), 'Destination search works');
      await page.evaluate(()=>clearTourSearch());
      const before = await page.locator('#tourGrid .product-card').count();
      await page.evaluate(()=>loadMoreTours());
      assert(await page.locator('#tourGrid .product-card').count() > before, 'Load More retains the catalogue');
    }
    assert.deepEqual(errors, [], route + ' runtime errors');
    await page.close();
  }

  // A failed optional search download leaves the page usable and a later attempt can retry.
  const retry = await browser.newPage();
  let attempts = 0;
  await retry.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await retry.route('**/assets/search.*.js', r => ++attempts === 1 ? r.abort() : r.continue());
  await retry.goto(base + '/');
  const failed = await retry.evaluate(()=>loadActivitySearch().then(()=>false, ()=>true));
  assert(failed);
  await retry.evaluate(()=>loadActivitySearch());
  assert.equal(await retry.evaluate(()=>window.RAAHHI_CATALOGUE.searchReady), true);
  await retry.close();
  const a = JSON.parse(await readFile('dist/build-report.json', 'utf8')).assets;
  assert(a.largestActivityInitialScriptGzipBytes < a.previousSharedScriptGzipBytes * .6, 'Initial compressed script payload reduced by at least 40%');
  console.log('PASS published catalogue: route chunks, image/card parity, full search parity, lazy loading/retry, destination search and Load More');
} finally { await browser.close(); server.close(); }
