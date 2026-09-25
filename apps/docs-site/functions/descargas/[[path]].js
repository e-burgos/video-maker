const DOWNLOAD_KEY_PATTERN = /^Video-Maker(-\d+\.\d+\.\d+)?-arm64\.dmg$/;
const DMG_CONTENT_TYPE = 'application/x-apple-diskimage';
const STABLE_FILE_NAME = 'Video-Maker-arm64.dmg';

export function keyFromParams(params) {
  const segments = params.path;
  if (segments === undefined) {
    return '';
  }
  return Array.isArray(segments) ? segments.join('/') : segments;
}

export function isDownloadableKey(key) {
  return DOWNLOAD_KEY_PATTERN.test(key);
}

export function cacheControlFor(key) {
  return key === STABLE_FILE_NAME ? 'public, max-age=300' : 'public, max-age=31536000, immutable';
}

function notFound(withBody) {
  return new Response(withBody ? 'Not found' : null, { status: 404 });
}

function baseHeaders(object, key) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', DMG_CONTENT_TYPE);
  headers.set('content-disposition', `attachment; filename="${key}"`);
  headers.set('cache-control', cacheControlFor(key));
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  return headers;
}

export async function onRequestGet({ params, request, env }) {
  const key = keyFromParams(params);
  if (!isDownloadableKey(key)) {
    return notFound(true);
  }

  const rangeHeader = request.headers.get('range');
  const object = await env.DOWNLOADS.get(key, rangeHeader !== null ? { range: request.headers } : undefined);
  if (object === null) {
    return notFound(true);
  }

  const headers = baseHeaders(object, key);

  if (object.range !== undefined) {
    const end = object.range.offset + object.range.length - 1;
    headers.set('content-length', String(object.range.length));
    headers.set('content-range', `bytes ${object.range.offset}-${end}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('content-length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

export async function onRequestHead({ params, env }) {
  const key = keyFromParams(params);
  if (!isDownloadableKey(key)) {
    return notFound(false);
  }

  const object = await env.DOWNLOADS.head(key);
  if (object === null) {
    return notFound(false);
  }

  const headers = baseHeaders(object, key);
  headers.set('content-length', String(object.size));
  return new Response(null, { status: 200, headers });
}
