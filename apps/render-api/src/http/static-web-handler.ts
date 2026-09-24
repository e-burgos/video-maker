import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path/posix';

import { PipelineStageError } from '../errors/pipeline-stage-error';
import { contentTypeFor } from './content-type-for';
import type { HttpResponse } from './http-message';

const INDEX_FILE_NAME = 'index.html';
const HASHED_ASSET_PATH_PREFIX = '/assets/';
const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const INDEX_CACHE_CONTROL = 'no-cache';

export interface StaticFileStat {
  readonly sizeBytes: number;
}

export interface StaticFileSystem {
  readonly stat: (path: string) => Promise<StaticFileStat | null>;
  readonly openReadStream: (path: string) => AsyncIterable<Uint8Array>;
}

async function nodeStaticStat(path: string): Promise<StaticFileStat | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? { sizeBytes: info.size } : null;
  } catch {
    return null;
  }
}

export const nodeStaticFileSystem: StaticFileSystem = {
  stat: nodeStaticStat,
  openReadStream: (path) => createReadStream(path),
};

function resolveWithinWebRoot(webRoot: string, pathname: string): string | null {
  const withoutLeadingSlash = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutLeadingSlash);
  } catch {
    return null;
  }

  const resolved = join(webRoot, decoded);
  const relativeToRoot = relative(webRoot, resolved);
  if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
    return null;
  }
  return resolved;
}

function cacheControlFor(pathname: string): string {
  return pathname.startsWith(HASHED_ASSET_PATH_PREFIX) ? HASHED_ASSET_CACHE_CONTROL : INDEX_CACHE_CONTROL;
}

export async function handleStaticWeb(
  webRoot: string,
  pathname: string,
  fs: StaticFileSystem = nodeStaticFileSystem,
): Promise<HttpResponse> {
  const requestedPath = pathname === '/' ? null : resolveWithinWebRoot(webRoot, pathname);
  const requestedStat = requestedPath === null ? null : await fs.stat(requestedPath);

  const fellBackToIndex = requestedPath === null || requestedStat === null;
  const servedPath = fellBackToIndex ? join(webRoot, INDEX_FILE_NAME) : requestedPath;
  const servedPathname = fellBackToIndex ? '/' : pathname;
  const servedStat = fellBackToIndex ? await fs.stat(servedPath) : requestedStat;

  if (servedStat === null) {
    throw new PipelineStageError({
      code: 'STATIC_WEB_NOT_FOUND',
      stage: null,
      resource: pathname,
      expected: 'RENDER_API_WEB_ROOT to contain a built index.html',
    });
  }

  return {
    status: 200,
    headers: {
      'content-type': contentTypeFor(servedPath),
      'content-length': String(servedStat.sizeBytes),
      'cache-control': cacheControlFor(servedPathname),
    },
    body: undefined,
    stream: () => fs.openReadStream(servedPath),
  };
}
