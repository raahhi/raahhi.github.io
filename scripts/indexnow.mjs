import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const origin = 'https://raahhi.com';
const endpoint = 'https://api.indexnow.org/indexnow';
export const indexNowKey = '21c444a92990bda57ca7289e3f9a43f280';

function validateManifest(pages) {
  if (!pages || typeof pages !== 'object' || Array.isArray(pages) || !Object.hasOwn(pages, '/')) {
    throw new Error('IndexNow manifest is missing the homepage.');
  }
  for (const [path, hash] of Object.entries(pages)) {
    const url = new URL(path, origin);
    if (url.origin !== origin || url.href !== origin + path || url.search || url.hash ||
        !path.endsWith('/') || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error('Invalid canonical page in IndexNow manifest: ' + path);
    }
  }
  return pages;
}

async function readPrevious(path) {
  try {
    return validateManifest(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function verifyPublicKey() {
  const keyUrl = origin + '/' + indexNowKey + '.txt';
  const response = await fetch(keyUrl, {redirect: 'error', signal: AbortSignal.timeout(15000)});
  if (!response.ok || (await response.text()).trim() !== indexNowKey) {
    throw new Error('IndexNow verification file is unavailable or has incorrect contents.');
  }
  return keyUrl;
}

async function submit(paths, keyLocation) {
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      host: new URL(origin).hostname,
      key: indexNowKey,
      keyLocation,
      urlList: paths.map(path => origin + path)
    })
  });
  if (![200, 202].includes(response.status)) {
    throw new Error('IndexNow returned HTTP ' + response.status + '. Keeping the prior checkpoint for retry.');
  }
  const status = response.status === 202 ? 'key validation pending' : 'received';
  console.log(`IndexNow ${status} (HTTP ${response.status}) for ${paths.length} URL(s):\n${paths.join('\n')}`);
}

async function run() {
  const previousPath = process.env.INDEXNOW_CHECKPOINT;
  const current = validateManifest(JSON.parse(process.env.INDEXNOW_CURRENT));
  const previous = await readPrevious(previousPath);
  const paths = previous ? [...new Set([...Object.keys(previous), ...Object.keys(current)])]
    .filter(path => previous[path] !== current[path]).sort() : [];
  if (paths.length > 10000) throw new Error('IndexNow batch exceeds the protocol limit.');
  if (!previous || paths.length) {
    const keyLocation = await verifyPublicKey();
    if (paths.length) await submit(paths, keyLocation);
    else console.log('IndexNow key verified. Saved the deployed URL baseline without a catalogue-wide submission.');
    await writeFile(previousPath, JSON.stringify(current) + '\n');
    await appendFile(process.env.GITHUB_OUTPUT, 'checkpoint_changed=true\n');
  } else {
    console.log('No canonical page changes to notify.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
