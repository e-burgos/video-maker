import { pickSfxVariant, sfxFilePath, sfxOfKind } from '@video-maker/motion-graphics';
import type { SfxBank, SfxEntry } from '@video-maker/motion-graphics';
import { planBumperSfx } from '@video-maker/timeline-core';
import type { BumperSfxAssetCue, BumperSfxAutoCue, Timeline } from '@video-maker/timeline-core';

import type { MixedSfxCredit, MixSfxCue } from '../deps/render-api-dependencies';

export interface ResolvedBumperSfx {
  readonly cues: readonly MixSfxCue[];
  readonly used: readonly SfxEntry[];
}

function bankLevelLufs(bank: SfxBank, entry: SfxEntry): number {
  return entry.momentaryMaxLufs ?? bank.referenceMomentaryLufs;
}

function autoCue(item: BumperSfxAutoCue, entry: SfxEntry, bank: SfxBank, assetsRoot: string, voiceTargetLufs: number): MixSfxCue {
  const targetLufs = voiceTargetLufs + item.gainDb;
  return {
    path: sfxFilePath(assetsRoot, entry),
    atMs: item.atMs,
    gainDb: Math.round((targetLufs - bankLevelLufs(bank, entry)) * 10) / 10,
    durationMs: entry.durationMs,
    fadeOutMs: item.fadeOutMs,
  };
}

function explicitSource(item: BumperSfxAssetCue, timeline: Timeline, bank: SfxBank, assetsRoot: string): { path: string; durationMs: number; entry: SfxEntry | null } | null {
  const entry = bank.sfx.find((candidate) => candidate.id === item.assetId);
  if (entry !== undefined) {
    return { path: sfxFilePath(assetsRoot, entry), durationMs: entry.durationMs, entry };
  }
  const asset = timeline.assets.find((candidate) => candidate.id === item.assetId);
  return asset === undefined ? null : { path: asset.path, durationMs: asset.durationMs, entry: null };
}

function assetCue(item: BumperSfxAssetCue, source: { path: string; durationMs: number }): MixSfxCue {
  return {
    path: source.path,
    atMs: item.atMs,
    gainDb: item.gainDb,
    durationMs: source.durationMs,
    ...(item.fadeInMs === undefined ? {} : { fadeInMs: item.fadeInMs }),
    ...(item.fadeOutMs === undefined ? {} : { fadeOutMs: item.fadeOutMs }),
  };
}

function variantSeed(timeline: Timeline): string {
  const seed = timeline.bumpers?.style?.seed;
  return seed === undefined ? timeline.id : String(seed);
}

function remember(used: SfxEntry[], entry: SfxEntry): void {
  if (!used.some((candidate) => candidate.id === entry.id)) used.push(entry);
}

export function resolveBumperSfx(timeline: Timeline, bank: SfxBank, assetsRoot: string): ResolvedBumperSfx {
  const voiceTargetLufs = timeline.audioMix.voice.integratedLufs;
  const seed = variantSeed(timeline);
  const cues: MixSfxCue[] = [];
  const used: SfxEntry[] = [];
  const usedIds: string[] = [];
  planBumperSfx(timeline).forEach((item, index) => {
    if (item.source === 'cue') {
      const source = explicitSource(item, timeline, bank, assetsRoot);
      if (source === null) return;
      if (source.entry !== null) remember(used, source.entry);
      cues.push(assetCue(item, source));
      return;
    }
    if (sfxOfKind(bank, item.kind).length === 0) return;
    const entry = pickSfxVariant(bank, item.kind, `${seed}:${item.edge}:${String(index)}`, usedIds);
    usedIds.push(entry.id);
    remember(used, entry);
    cues.push(autoCue(item, entry, bank, assetsRoot, voiceTargetLufs));
  });
  return { cues, used };
}

export function toMixedSfxCredit(entry: SfxEntry): MixedSfxCredit {
  return { file: entry.file, title: entry.title, author: entry.author, license: entry.license, sourceUrl: entry.sourceUrl };
}
