import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { searchCommonsMedia } from './commons-media-search';
import { searchNasaMedia } from './nasa-media-search';
import type { FreeMediaKind, FreeMediaResult } from './free-media-result';

async function searchSourceOrEmpty(search: Promise<readonly FreeMediaResult[]>): Promise<readonly FreeMediaResult[]> {
  try {
    return await search;
  } catch {
    return [];
  }
}

function interleave(
  first: readonly FreeMediaResult[],
  second: readonly FreeMediaResult[],
): readonly FreeMediaResult[] {
  const merged: FreeMediaResult[] = [];
  const longest = Math.max(first.length, second.length);
  for (let index = 0; index < longest; index += 1) {
    const fromFirst = first[index];
    const fromSecond = second[index];
    if (fromFirst !== undefined) {
      merged.push(fromFirst);
    }
    if (fromSecond !== undefined) {
      merged.push(fromSecond);
    }
  }
  return merged;
}

export async function searchFreeMedia(
  fetchRemote: FetchRemotePort,
  query: string,
  kind: FreeMediaKind,
  maxResults: number,
): Promise<readonly FreeMediaResult[]> {
  const [commonsResults, nasaResults] = await Promise.all([
    searchSourceOrEmpty(searchCommonsMedia(fetchRemote, query, kind, maxResults)),
    searchSourceOrEmpty(searchNasaMedia(fetchRemote, query, kind, maxResults)),
  ]);

  if (commonsResults.length === 0 && nasaResults.length === 0) {
    throw new Error('Neither Wikimedia Commons nor the NASA Image and Video Library answered with a usable result');
  }

  return interleave(commonsResults, nasaResults).slice(0, maxResults);
}
