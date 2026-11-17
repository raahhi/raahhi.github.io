import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const pathPattern = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/;
export function validateRegistry(registry, previous) {
  assert.equal(registry.version, 1, 'Unsupported published URL register');
  assert.equal(registry.origin, 'https://raahhi.com', 'Published origin must remain stable');
  assert(Array.isArray(registry.pages) && registry.pages.length > 0, 'Empty published URL register');
  const ids = new Map(), paths = new Set();
  for (const page of registry.pages) {
    assert(page.pageId && page.kind, 'Every published page needs an immutable identity and kind');
    assert(pathPattern.test(page.path), 'Invalid canonical path: ' + page.path);
    assert.equal(page.state, 'live', 'Retirement needs serving-layer lifecycle support before registration: ' + page.path);
    assert(!ids.has(page.pageId), 'Duplicate page identity: ' + page.pageId);
    assert(!paths.has(page.path), 'Duplicate published path: ' + page.path);
    ids.set(page.pageId, page); paths.add(page.path);
  }
  if (previous) {
    assert.equal(registry.origin, previous.origin);
    for (const old of previous.pages) {
      const page = ids.get(old.pageId);
      assert(page, 'Published identity removed: ' + old.pageId);
      for (const field of ['path', 'kind', 'state']) {
        assert.equal(page[field], old[field], 'Published ' + field + ' changed for ' + old.pageId);
      }
    }
  }
  return ids;
}

export function registryAtRef(ref) {
  // The initial registry release has no older file. Check existence separately so
  // malformed JSON, an unavailable ref or a Git failure cannot silently skip history.
  const listing = execFileSync('git', ['ls-tree', '--name-only', ref, '--', 'source/published-urls.json'], {encoding:'utf8'}).trim();
  if (!listing) return null;
  return JSON.parse(execFileSync('git', ['show', ref + ':source/published-urls.json'], {encoding:'utf8'}));
}

export function validatePublishedGraph(registry, snapshots, sitemapPaths) {
  const ids = validateRegistry(registry), byPath = new Map(registry.pages.map(p => [p.path,p]));
  const indexable = new Set(sitemapPaths), incoming = new Map(registry.pages.map(p => [p.path,new Set()]));
  const edges = new Map(), fragmentLinks = [];
  assert.equal(snapshots.size, registry.pages.length, 'Register must include every generated route');
  assert.equal(indexable.size, registry.pages.length, 'Registered live pages must be sitemap-eligible');
  for (const [path, page] of snapshots) {
    const registered = ids.get(page.pageId);
    assert(registered, 'Unregistered page identity: ' + page.pageId);
    assert.equal(registered.path, path, 'Published page moved: ' + page.pageId);
    assert.equal(registered.kind, page.kind, 'Page kind changed: ' + path);
    assert.equal(page.path, path, 'Rendered route differs from requested route: ' + path);
    assert.equal(page.canonical, registry.origin + path, 'Canonical mismatch: ' + path);
    assert(!/noindex/i.test(page.robots), 'Published live page became noindex: ' + path);
    assert(indexable.has(path), 'Published page missing from sitemap: ' + path);
    const targets = new Set();
    for (const link of page.links) {
      const url = new URL(link.href, registry.origin + path);
      if (url.origin !== registry.origin) continue;
      assert(byPath.has(url.pathname), 'Unpublished internal target: ' + path + ' -> ' + link.href);
      assert(!url.search, 'Internal link carries query parameters: ' + path + ' -> ' + link.href);
      assert(!/\bnofollow\b/i.test(link.rel || ''), 'Internal nofollow: ' + path + ' -> ' + link.href);
      assert.notEqual(link.target, '_blank', 'Internal link opens a new tab: ' + path + ' -> ' + link.href);
      if (url.hash && !url.hash.startsWith('#:~:')) fragmentLinks.push({from:path,to:url.pathname,id:decodeURIComponent(url.hash.slice(1))});
      if (url.pathname !== path) { targets.add(url.pathname); incoming.get(url.pathname).add(path); }
    }
    edges.set(path, targets);
  }
  for (const link of fragmentLinks) assert(snapshots.get(link.to)?.ids.includes(link.id), 'Broken fragment: ' + link.from + ' -> ' + link.to + '#' + link.id);
  const depths = new Map([['/',0]]), queue = ['/'];
  for (let i=0;i<queue.length;i++) {
    const path=queue[i];
    for (const target of edges.get(path) || []) if (!depths.has(target)) {depths.set(target,depths.get(path)+1);queue.push(target);}
  }
  for (const page of registry.pages) {
    assert(page.path === '/' || incoming.get(page.path).size, 'Orphan published URL: ' + page.path);
    assert((depths.get(page.path) ?? Infinity) <= 3, 'Published URL beyond three clicks: ' + page.path);
  }
  return {registeredPages:ids.size,internalEdges:[...edges.values()].reduce((n,s)=>n+s.size,0),checkedFragments:fragmentLinks.length,maxHomepageDepth:Math.max(...depths.values()),orphans:0};
}
