import { basename } from 'node:path';

import { collectBrandMusic, parseBrandManifest, resolveBrandTrackSource } from '@video-maker/motion-graphics';
import type { BrandTrack } from '@video-maker/motion-graphics';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { CommonsMusicResult } from './commons-music-search';
import { brandDirLocator, brandMusicReaders } from './brand-music-readers';
import { lastUseByTrack } from './music-usage-log';

export const BRAND_BANK_RESULT_PREFIX = 'bank-';

export interface FreeMusicResult extends CommonsMusicResult {
  readonly source: 'brand-bank' | 'commons';
  readonly localPath?: string;
  readonly creditTitle?: string;
  readonly brandId?: string;
  readonly trackId?: string;
}

interface BankCandidate {
  readonly track: BrandTrack;
  readonly score: number;
  readonly lastUsedAt: string;
}

const QUOTED_TITLE = /^"([^"]+)"\s*(.*)$/u;

function queryWords(mood: string): string[] {
  return mood
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length > 0);
}

function trackWords(track: BrandTrack): Set<string> {
  return new Set(queryWords([track.id, track.mood, ...(track.videoTypes ?? [])].join(' ')));
}

function matchScore(track: BrandTrack, words: readonly string[]): number {
  const vocabulary = trackWords(track);
  return words.filter((word) => vocabulary.has(word)).length;
}

function splitCredit(track: BrandTrack): { readonly title: string; readonly author: string; readonly license: string } {
  const [authorPart = track.credit, license = ''] = track.credit.split(' · ');
  const quoted = QUOTED_TITLE.exec(authorPart);
  return quoted === null
    ? { title: track.id, author: authorPart, license }
    : { title: quoted[1] ?? track.id, author: quoted[2] ?? '', license };
}

function rankCandidates(left: BankCandidate, right: BankCandidate): number {
  return right.score - left.score || left.lastUsedAt.localeCompare(right.lastUsedAt);
}

async function readBrandMusic(deps: RenderApiDependencies, store: StoreConfig, brandId: string): Promise<readonly BrandTrack[] | null> {
  const document = (await deps.listMotionBrands()).find((candidate) => candidate.id === brandId);
  if (document === undefined) {
    return null;
  }
  return collectBrandMusic(brandMusicReaders(deps, store), brandId, parseBrandManifest(document.manifest));
}

async function durationOf(deps: RenderApiDependencies, path: string, trackId: string): Promise<number> {
  try {
    return Math.round((await deps.probeAsset({ path, assetId: trackId })).durationMs);
  } catch {
    return 0;
  }
}

export async function searchBrandMusicBank(
  deps: RenderApiDependencies,
  store: StoreConfig,
  brandId: string | null,
  mood: string,
  maxResults: number,
): Promise<FreeMusicResult[]> {
  if (brandId === null) {
    return [];
  }
  const music = await readBrandMusic(deps, store, brandId);
  if (music === null) {
    return [];
  }
  const words = queryWords(mood);
  const lastUse = await lastUseByTrack(deps.storage, store.mediaRoot, brandId);
  const picked = music
    .map((track) => ({ track, score: matchScore(track, words), lastUsedAt: lastUse.get(track.id) ?? '' }))
    .filter((candidate) => candidate.score > 0)
    .sort(rankCandidates)
    .slice(0, maxResults);

  return Promise.all(
    picked.map(async ({ track }) => {
      const localPath = await resolveBrandTrackSource(brandDirLocator(deps, store), store.brandsRoot, brandId, track.file);
      const { title, author, license } = splitCredit(track);
      return {
        resultId: `${BRAND_BANK_RESULT_PREFIX}${track.id}`,
        title: `${title} (${track.mood}${track.videoTypes === undefined ? '' : `; for ${track.videoTypes.join('/')} videos`})`,
        durationMs: await durationOf(deps, localPath, track.id),
        license,
        author,
        pageUrl: '',
        downloadUrl: '',
        source: 'brand-bank' as const,
        localPath,
        creditTitle: title,
        brandId,
        trackId: track.id,
      };
    }),
  );
}

export function brandBankFileName(result: FreeMusicResult): string {
  return result.localPath === undefined ? `${result.resultId}.mp3` : basename(result.localPath);
}
