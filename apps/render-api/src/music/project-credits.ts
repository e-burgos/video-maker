import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { dirname } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';

export const CREDITS_FILE_PATH = 'work/credits.json';

export const CREDIT_KINDS = ['music', 'video', 'image'] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

export interface MediaCreditEntry {
  readonly kind: CreditKind;
  readonly path: string;
  readonly title: string;
  readonly author: string;
  readonly license: string;
  readonly sourceUrl: string;
  readonly importedAt: string;
}

export type MusicCreditEntry = MediaCreditEntry & { readonly kind: 'music' };

function isCreditKind(value: unknown): value is CreditKind {
  return typeof value === 'string' && (CREDIT_KINDS as readonly string[]).includes(value);
}

function isMediaCreditEntry(value: unknown): value is MediaCreditEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    isCreditKind((value as Record<string, unknown>).kind) &&
    typeof (value as Record<string, unknown>).path === 'string'
  );
}

async function readCreditEntries(storage: ObjectStorage, absolutePath: string): Promise<readonly MediaCreditEntry[]> {
  const fileStat = await storage.stat(absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    return [];
  }

  try {
    const raw = await storage.readTextFile(absolutePath);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMediaCreditEntry) : [];
  } catch {
    return [];
  }
}

export async function appendMediaCredit(
  storage: ObjectStorage,
  project: MediaProject,
  entry: MediaCreditEntry,
): Promise<void> {
  const absolutePath = toAbsolutePath(project, CREDITS_FILE_PATH);
  const existing = await readCreditEntries(storage, absolutePath);
  const updated = [...existing, entry];

  await storage.ensureDirectory(dirname(absolutePath));
  await storage.writeTextFile(absolutePath, `${JSON.stringify(updated, null, 2)}\n`);
}

export const appendMusicCredit = appendMediaCredit;
