import type {
  AssetRole,
  FreeMediaResult,
  FreeMusicResult,
  RenderApiClientFacade,
} from './free-media-types';
import type { TranslationKey } from '../../../i18n/messages-en';

export const FREE_MEDIA_TABS = ['image', 'video', 'music'] as const;

export type FreeMediaTab = (typeof FREE_MEDIA_TABS)[number];

export const FREE_MEDIA_TAB_LABEL: Readonly<Record<FreeMediaTab, TranslationKey>> = {
  image: 'library.freeMedia.tab.image',
  video: 'library.freeMedia.tab.video',
  music: 'library.freeMedia.tab.music',
};

export const FREE_MEDIA_TABS_ID_BASE = 'free-media-tabs';

export const RESULT_CAP_OPTIONS = [5, 10] as const;

export const DEFAULT_RESULT_CAP = 10;

export const IMPORT_ROLE_BY_TAB: Readonly<Record<FreeMediaTab, AssetRole>> = {
  image: 'image',
  video: 'broll',
  music: 'audio',
};

export const SOURCE_LABEL: Readonly<Record<string, TranslationKey>> = {
  commons: 'library.freeMedia.source.commons',
  nasa: 'library.freeMedia.source.nasa',
  openverse: 'library.freeMedia.source.openverse',
  'brand-bank': 'library.freeMedia.source.brandBank',
};

export type FreeResult = {
  resultId: string;
  tab: FreeMediaTab;
  source: string;
  title: string;
  license: string;
  author: string;
  pageUrl: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export function fromMedia(result: FreeMediaResult): FreeResult {
  return { ...result, tab: result.kind };
}

export function fromMusic(result: FreeMusicResult): FreeResult {
  return { ...result, tab: 'music', width: null, height: null };
}

export function tabsForMode(isMotion: boolean): readonly FreeMediaTab[] {
  return isMotion ? ['image'] : FREE_MEDIA_TABS;
}

export function searchFreeResults(
  client: RenderApiClientFacade,
  slug: string,
  tab: FreeMediaTab,
  text: string,
  maxResults: number,
): Promise<FreeResult[]> {
  if (tab === 'music') {
    return client.searchFreeMusic({ slug, mood: text, maxResults }).then((results) => results.map(fromMusic));
  }
  return client.searchFreeMedia({ slug, query: text, kind: tab, maxResults }).then((results) => results.map(fromMedia));
}

export function importFreeResult(client: RenderApiClientFacade, slug: string, result: FreeResult) {
  return result.tab === 'music'
    ? client.importFreeMusic(slug, result.resultId)
    : client.importFreeMedia(slug, result.resultId);
}

export function formatDuration(durationMs: number | null): string | null {
  if (durationMs === null || durationMs <= 0) {
    return null;
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatDimensions(width: number | null, height: number | null): string | null {
  return width === null || height === null ? null : `${width}×${height}`;
}
