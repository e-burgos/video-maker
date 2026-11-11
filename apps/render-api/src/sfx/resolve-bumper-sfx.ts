import { pickSfxVariant, sfxFilePath } from '@video-maker/motion-graphics';
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

function assetCue(item: BumperSfxAssetCue, timeline: Timeline): MixSfxCue | null {
  const asset = timeline.assets.find((candidate) => candidate.id === item.assetId);
  if (asset === undefined) {
    return null;
  }
  return {
    path: asset.path,
    atMs: item.atMs,
    gainDb: item.gainDb,
    durationMs: asset.durationMs,
    ...(item.fadeInMs === undefined ? {} : { fadeInMs: item.fadeInMs }),
    ...(item.fadeOutMs === undefined ? {} : { fadeOutMs: item.fadeOutMs }),
  };
}

export function resolveBumperSfx(timeline: Timeline, bank: SfxBank, assetsRoot: string): ResolvedBumperSfx {
  const voiceTargetLufs = timeline.audioMix.voice.integratedLufs;
  const cues: MixSfxCue[] = [];
  const used: SfxEntry[] = [];
  const usedIds: string[] = [];
  planBumperSfx(timeline).forEach((item, index) => {
    if (item.source === 'cue') {
      const cue = assetCue(item, timeline);
      if (cue !== null) cues.push(cue);
      return;
    }
    const entry = pickSfxVariant(bank, item.kind, `${timeline.id}:${item.edge}:${String(index)}`, usedIds);
    usedIds.push(entry.id);
    if (!used.some((candidate) => candidate.id === entry.id)) used.push(entry);
    cues.push(autoCue(item, entry, bank, assetsRoot, voiceTargetLufs));
  });
  return { cues, used };
}

export function toMixedSfxCredit(entry: SfxEntry): MixedSfxCredit {
  return { file: entry.file, title: entry.title, author: entry.author, license: entry.license, sourceUrl: entry.sourceUrl };
}
