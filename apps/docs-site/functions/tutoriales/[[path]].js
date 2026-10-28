const TUTORIAL_KEY = 'Tutorial-Video-Maker.mp4';
const VIDEO_CONTENT_TYPE = 'video/mp4';
const CACHE_CONTROL = 'public, max-age=86400';

export function keyFromParams(params) {
  const segments = params.path;
  if (segments === undefined) {
    return '';
  }
  return Array.isArray(segments) ? segments.join('/') : segments;
}

export function isTutorialKey(key) {
  return key === TUTORIAL_KEY;
}

function notFound(withBody) {
  return new Response(withBody ? 'Not found' : null, { status: 404 });
}

function baseHeaders(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', VIDEO_CONTENT_TYPE);
  headers.set('cache-control', CACHE_CONTROL);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  return headers;
}

export async function onRequestGet({ params, request, env }) {
  const key = keyFromParams(params);
  if (!isTutorialKey(key)) {
    return notFound(true);
  }

  const rangeHeader = request.headers.get('range');
  const object = await env.DOWNLOADS.get(key, rangeHeader !== null ? { range: request.headers } : undefined);
  if (object === null) {
    return notFound(true);
  }

  const headers = baseHeaders(object);

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
  if (!isTutorialKey(key)) {
    return notFound(false);
  }

  const object = await env.DOWNLOADS.head(key);
  if (object === null) {
    return notFound(false);
  }

  const headers = baseHeaders(object);
  headers.set('content-length', String(object.size));
  return new Response(null, { status: 200, headers });
}
