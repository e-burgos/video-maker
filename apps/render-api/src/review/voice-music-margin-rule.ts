import type { FindingDraft } from './review-finding-builder';
import { formatDb } from './review-finding-builder';
import type { VoiceSegmentLevels } from './review-inputs';
import { VOICE_MUSIC_CRITICAL_MARGIN_DB, VOICE_MUSIC_SUGGESTION_MARGIN_DB } from './review-thresholds';

const CHECK = 'voice-music-margin';

export type NoiseCause = 'music' | 'sound-effects';

export interface SegmentMargin {
  readonly segment: VoiceSegmentLevels;
  readonly marginDb: number;
  readonly cause: NoiseCause;
}

export function sumPowersDb(levelsDb: readonly number[]): number | null {
  if (levelsDb.length <= 1) {
    return levelsDb[0] ?? null;
  }
  return 10 * Math.log10(levelsDb.reduce((sum, db) => sum + 10 ** (db / 10), 0));
}

function musicLevelDb(segment: VoiceSegmentLevels): number | null {
  return segment.musicLufs === null ? null : segment.musicLufs + segment.musicGainDb;
}

function soundEffectsLevelDb(segment: VoiceSegmentLevels): number | null {
  return sumPowersDb((segment.sfx ?? []).map((effect) => effect.lufs + effect.gainDb));
}

function causeOf(voiceLufs: number, musicDb: number | null, effectsDb: number | null): NoiseCause {
  if (effectsDb === null) {
    return 'music';
  }
  const musicAloneIsEnough = musicDb !== null && voiceLufs - musicDb >= VOICE_MUSIC_SUGGESTION_MARGIN_DB;
  return musicDb === null || musicAloneIsEnough || effectsDb >= musicDb ? 'sound-effects' : 'music';
}

function marginOf(segment: VoiceSegmentLevels): SegmentMargin | null {
  if (segment.voiceLufs === null) {
    return null;
  }
  const musicDb = musicLevelDb(segment);
  const effectsDb = soundEffectsLevelDb(segment);
  const noiseDb = sumPowersDb([musicDb, effectsDb].filter((level): level is number => level !== null));
  return noiseDb === null
    ? null
    : { segment, marginDb: segment.voiceLufs - noiseDb, cause: causeOf(segment.voiceLufs, musicDb, effectsDb) };
}

export function voiceMusicMargins(segments: readonly VoiceSegmentLevels[]): SegmentMargin[] {
  return segments.flatMap((segment) => marginOf(segment) ?? []);
}

export function worstMarginDb(margins: readonly SegmentMargin[]): number | null {
  return margins.length === 0 ? null : Math.min(...margins.map((margin) => margin.marginDb));
}

function marginMessage({ marginDb, cause }: SegmentMargin): string {
  const competitor = cause === 'music' ? 'a la música' : 'a la música y los efectos de sonido';
  return `En este tramo la voz supera ${competitor} solo por ${formatDb(marginDb)} dB y se pide al menos ${String(VOICE_MUSIC_CRITICAL_MARGIN_DB)} dB.`;
}

function criticalFix({ marginDb, cause }: SegmentMargin): string {
  const missingDb = formatDb(VOICE_MUSIC_SUGGESTION_MARGIN_DB - marginDb);
  return cause === 'music'
    ? `Bajar la música bajo la voz al menos ${missingDb} dB en este tramo (nivel de ducking más profundo o música más baja).`
    : `Bajar el efecto de sonido que suena en este tramo al menos ${missingDb} dB (volumen más bajo o quitarlo) para que no tape la voz.`;
}

function marginFinding(margin: SegmentMargin): FindingDraft | null {
  const { segment, marginDb } = margin;
  const timeRange = { startSec: segment.startSec, endSec: segment.endSec };
  const message = marginMessage(margin);
  if (marginDb < VOICE_MUSIC_CRITICAL_MARGIN_DB) {
    return { check: CHECK, severity: 'critical', message, timeRange, proposedFix: criticalFix(margin) };
  }
  return marginDb < VOICE_MUSIC_SUGGESTION_MARGIN_DB
    ? { check: CHECK, severity: 'suggestion', message: `${message} Lo recomendable son ${String(VOICE_MUSIC_SUGGESTION_MARGIN_DB)} dB.`, timeRange }
    : null;
}

export function voiceMusicMarginFindings(margins: readonly SegmentMargin[]): FindingDraft[] {
  return margins.map(marginFinding).filter((finding): finding is FindingDraft => finding !== null);
}
