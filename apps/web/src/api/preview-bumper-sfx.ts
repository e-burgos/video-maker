import { createSeededRandom, hashStringToSeed, pickAvoidingRecent, planBumperSfx } from '@video-maker/timeline-core';
import type { BumperSfxAssetCue, BumperSfxAutoCue, Timeline } from '@video-maker/timeline-core';
import type { PreviewSfxCue } from '@video-maker/composition-remotion';

export type SfxFileUrl = (file: string) => string | undefined;

export interface SfxEntry {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly durationMs: number;
  readonly momentaryMaxLufs: number | null;
}

export interface SfxBank {
  readonly referenceMomentaryLufs: number;
  readonly sfx: readonly SfxEntry[];
}

function sfxOfKind(bank: SfxBank, kind: string): SfxEntry[] {
  return bank.sfx.filter((entry) => entry.kind === kind);
}

export function pickSfxVariant(bank: SfxBank, kind: string, seedKey: string, recentIds: readonly string[]): SfxEntry | null {
  const [first, ...rest] = sfxOfKind(bank, kind);
  if (first === undefined) {
    return null;
  }
  const next = createSeededRandom(hashStringToSeed(`sfx:${kind}:${seedKey}`));
  const id = pickAvoidingRecent([first.id, ...rest.map((entry) => entry.id)], recentIds, next);
  return [first, ...rest].find((entry) => entry.id === id) ?? first;
}

function isSfxBank(value: unknown): value is SfxBank {
  return typeof value === 'object' && value !== null && Array.isArray((value as { sfx?: unknown }).sfx);
}

function dbToVolume(gainDb: number): number {
  return Math.min(1, Math.max(0, 10 ** (gainDb / 20)));
}

function variantSeed(timeline: Timeline): string {
  const seed = timeline.bumpers?.style?.seed;
  return seed === undefined ? timeline.id : String(seed);
}

function autoCue(item: BumperSfxAutoCue, entry: SfxEntry, bank: SfxBank, timeline: Timeline, url: string): PreviewSfxCue {
  const targetLufs = timeline.audioMix.voice.integratedLufs + item.gainDb;
  const fileLufs = entry.momentaryMaxLufs ?? bank.referenceMomentaryLufs;
  return { src: url, atMs: item.atMs, durationMs: entry.durationMs, volume: dbToVolume(targetLufs - fileLufs) };
}

function assetCue(item: BumperSfxAssetCue, src: string, durationMs: number): PreviewSfxCue {
  return { src, atMs: item.atMs, durationMs, volume: dbToVolume(item.gainDb) };
}

function explicitCue(item: BumperSfxAssetCue, timeline: Timeline, bank: SfxBank, fileUrl: SfxFileUrl): PreviewSfxCue | null {
  const entry = bank.sfx.find((candidate) => candidate.id === item.assetId);
  const entryUrl = entry === undefined ? undefined : fileUrl(entry.file);
  if (entry !== undefined && entryUrl !== undefined) {
    return assetCue(item, entryUrl, entry.durationMs);
  }
  const asset = timeline.assets.find((candidate) => candidate.id === item.assetId);
  return asset === undefined ? null : assetCue(item, asset.path, asset.durationMs);
}

export function previewBumperSfx(timeline: Timeline, bank: SfxBank, fileUrl: SfxFileUrl): PreviewSfxCue[] {
  const seed = variantSeed(timeline);
  const usedIds: string[] = [];
  const cues: PreviewSfxCue[] = [];
  planBumperSfx(timeline).forEach((item, index) => {
    if (item.source === 'cue') {
      const cue = explicitCue(item, timeline, bank, fileUrl);
      if (cue !== null) cues.push(cue);
      return;
    }
    const entry = pickSfxVariant(bank, item.kind, `${seed}:${item.edge}:${String(index)}`, usedIds);
    if (entry === null) return;
    usedIds.push(entry.id);
    const url = fileUrl(entry.file);
    if (url !== undefined) cues.push(autoCue(item, entry, bank, timeline, url));
  });
  return cues;
}

const BANK_MANIFESTS = import.meta.glob('../../../../libs/motion-graphics/assets/sfx-bank/sfx-bank.json', {
  eager: true,
  import: 'default',
});
const BANK_FILE_URLS = import.meta.glob('../../../../libs/motion-graphics/assets/sfx-bank/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const bundledSfxBank: SfxBank | null = (() => {
  const [manifest] = Object.values(BANK_MANIFESTS);
  return isSfxBank(manifest) ? manifest : null;
})();

export function bundledSfxFileUrl(file: string): string | undefined {
  return Object.entries(BANK_FILE_URLS).find(([path]) => path.endsWith(`/${file}`))?.[1];
}

export function bundledPreviewBumperSfx(timeline: Timeline): PreviewSfxCue[] {
  return bundledSfxBank === null ? [] : previewBumperSfx(timeline, bundledSfxBank, bundledSfxFileUrl);
}
