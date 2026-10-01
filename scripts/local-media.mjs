import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Four existing, rights-recorded photos are served from the same host as the page.
// Their original catalogue URLs remain the keys for alt text and licence attribution.
export async function loadLocalMedia(root) {
  const manifest = JSON.parse(await readFile(join(root,'source','media','manifest.json'),'utf8'));
  const files = new Map();
  const map = {};
  for (const [original, record] of Object.entries(manifest)) {
    const variants = [];
    for (const v of record.variants) {
      if (!/^[a-z0-9-]+\.webp$/.test(v.file)) throw new Error('Invalid local image filename');
      const bytes = await readFile(join(root,'source','media',v.file));
      if (bytes.length !== v.bytes) throw new Error('Local image size mismatch: '+v.file);
      const url = '/assets/media/'+v.file;
      files.set(url,bytes);
      variants.push({width:v.width,height:v.height,url});
    }
    map[original] = {variants};
  }
  return {map,files,bootstrap:'<script data-local-media>window.RAAHHI_MEDIA='+JSON.stringify(map).replace(/</g,'\\u003c')+';</script>'};
}
