import { join } from 'node:path';

import type { ObjectStorage } from '../deps/object-storage';

export const MUSIC_USAGE_LOG_FILE = '.music-usage.json';
export const RECENT_TRACKS_TO_AVOID = 3;

type MusicUsageLog = Readonly<Record<string, string>>;

function usageKey(brandId: string, trackId: string): string {
  return `${brandId}/${trackId}`;
}

function musicUsageLogPath(mediaRoot: string): string {
  return join(mediaRoot, MUSIC_USAGE_LOG_FILE);
}

function isUsageLog(value: unknown): value is MusicUsageLog {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

async function readUsageLog(storage: ObjectStorage, mediaRoot: string): Promise<MusicUsageLog> {
  const path = musicUsageLogPath(mediaRoot);
  if ((await storage.stat(path))?.kind !== 'file') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(await storage.readTextFile(path));
    return isUsageLog(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function lastUseByTrack(storage: ObjectStorage, mediaRoot: string, brandId: string): Promise<ReadonlyMap<string, string>> {
  const prefix = `${brandId}/`;
  const entries = Object.entries(await readUsageLog(storage, mediaRoot))
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, usedAt]): [string, string] => [key.slice(prefix.length), usedAt]);
  return new Map(entries);
}

export async function recentlyUsedTracks(storage: ObjectStorage, mediaRoot: string, brandId: string, limit = RECENT_TRACKS_TO_AVOID): Promise<string[]> {
  return [...(await lastUseByTrack(storage, mediaRoot, brandId))]
    .sort(([, left], [, right]) => right.localeCompare(left))
    .slice(0, limit)
    .map(([trackId]) => trackId);
}

export async function recordMusicUse(storage: ObjectStorage, mediaRoot: string, brandId: string, trackId: string, usedAt: string): Promise<void> {
  const log = { ...(await readUsageLog(storage, mediaRoot)), [usageKey(brandId, trackId)]: usedAt };
  await storage.writeTextFile(musicUsageLogPath(mediaRoot), `${JSON.stringify(log, null, 2)}\n`);
}
