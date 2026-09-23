import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { dirname } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';

export const CREDITS_FILE_PATH = 'work/credits.json';

export interface MusicCreditEntry {
  readonly kind: 'music';
  readonly path: string;
  readonly title: string;
  readonly author: string;
  readonly license: string;
  readonly sourceUrl: string;
  readonly importedAt: string;
}

function isMusicCreditEntry(value: unknown): value is MusicCreditEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).kind === 'music' &&
    typeof (value as Record<string, unknown>).path === 'string'
  );
}

async function readCreditEntries(storage: ObjectStorage, absolutePath: string): Promise<readonly MusicCreditEntry[]> {
  const fileStat = await storage.stat(absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    return [];
  }

  try {
    const raw = await storage.readTextFile(absolutePath);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMusicCreditEntry) : [];
  } catch {
    return [];
  }
}

export async function appendMusicCredit(
  storage: ObjectStorage,
  project: MediaProject,
  entry: MusicCreditEntry,
): Promise<void> {
  const absolutePath = toAbsolutePath(project, CREDITS_FILE_PATH);
  const existing = await readCreditEntries(storage, absolutePath);
  const updated = [...existing, entry];

  await storage.ensureDirectory(dirname(absolutePath));
  await storage.writeTextFile(absolutePath, `${JSON.stringify(updated, null, 2)}\n`);
}
