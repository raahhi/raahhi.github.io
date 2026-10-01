import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {transform} from 'esbuild';

// Keep the authoring preview intact. Only the published assets are optimized.
// Top-level names must survive: static HTML uses inline event handlers.
export async function compileSiteAssets(source, appScript) {
  const styles = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!styles) throw new Error('Missing shared stylesheet');
  const auditStart = appScript.indexOf('const MEDIA_SOURCES = {');
  const auditEnd = appScript.indexOf('// Images whose licence requires visible attribution', auditStart);
  if (auditStart < 0 || auditEnd < 0 || /\bMEDIA_SOURCES\b/.test(appScript.slice(auditEnd).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''))) {
    throw new Error('Media audit table boundary or runtime dependencies changed');
  }
  // Full source/rights records stay in source control; visible licence credits stay in the app.
  const runtime = appScript.slice(0, auditStart) + appScript.slice(auditEnd);
  const [js, css] = await Promise.all([
    transform(runtime, {loader:'js', target:'es2020', minifyWhitespace:true, minifySyntax:true, minifyIdentifiers:false, legalComments:'none'}),
    transform(styles[1], {loader:'css', minify:true, legalComments:'none'})
  ]);
  const files = new Map();
  function asset(name, extension, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const path = `/assets/${name}.${hash}.${extension}`;
    files.set(path, buffer);
    return path;
  }
  const scriptUrl = asset('app', 'js', js.code);
  const styleUrl = asset('site', 'css', css.code);
  const images = new Map();
  for (const match of source.matchAll(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)(?=")/g)) {
    if (!images.has(match[0])) images.set(match[0], asset('brand', match[1] === 'jpeg' ? 'jpg' : 'png', Buffer.from(match[2].replace(/\s/g,''), 'base64')));
  }
  function attach(html, bootstrap) {
    let result = html.replace(/<style>[\s\S]*?<\/style>/, `<link rel="stylesheet" href="${styleUrl}">`)
      .replace('</head>', bootstrap + '</head>')
      .replace('<!--APP_SCRIPT-->', `<script id="appScript" src="${scriptUrl}" defer></script>`);
    for (const [embedded, url] of images) result = result.split(embedded).join(url);
    if (/<style>|data:image\/(?:png|jpeg);base64/.test(result)) throw new Error('Repeated inline assets remain in output');
    return result;
  }
  return {files, scriptUrl, styleUrl, attach, report:{
    originalScriptBytes:Buffer.byteLength(appScript), publishedScriptBytes:Buffer.byteLength(js.code),
    originalScriptGzipBytes:gzipSync(appScript).length, publishedScriptGzipBytes:gzipSync(js.code).length,
    sharedStylesBytes:Buffer.byteLength(css.code), extractedBrandImages:images.size
  }};
}
