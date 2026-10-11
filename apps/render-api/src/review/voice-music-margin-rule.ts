import type { FindingDraft } from './review-finding-builder';
import { formatDb } from './review-finding-builder';
import type { VoiceSegmentLevels } from './review-inputs';
import { VOICE_MUSIC_CRITICAL_MARGIN_DB, VOICE_MUSIC_SUGGESTION_MARGIN_DB } from './review-thresholds';

const CHECK = 'voice-music-margin';

export interface SegmentMargin {
  readonly segment: VoiceSegmentLevels;
  readonly marginDb: number;
}

export function voiceMusicMargins(segments: readonly VoiceSegmentLevels[]): SegmentMargin[] {
  return segments.flatMap((segment) =>
    segment.voiceLufs === null || segment.musicLufs === null
      ? []
      : [{ segment, marginDb: segment.voiceLufs - (segment.musicLufs + segment.musicGainDb) }],
  );
}

export function worstMarginDb(margins: readonly SegmentMargin[]): number | null {
  return margins.length === 0 ? null : Math.min(...margins.map((margin) => margin.marginDb));
}

function marginFinding({ segment, marginDb }: SegmentMargin): FindingDraft | null {
  const timeRange = { startSec: segment.startSec, endSec: segment.endSec };
  const message = `En este tramo la voz supera a la música solo por ${formatDb(marginDb)} dB y se pide al menos ${String(VOICE_MUSIC_CRITICAL_MARGIN_DB)} dB.`;
  if (marginDb < VOICE_MUSIC_CRITICAL_MARGIN_DB) {
    return {
      check: CHECK,
      severity: 'critical',
      message,
      timeRange,
      proposedFix: `Bajar la música bajo la voz al menos ${formatDb(VOICE_MUSIC_SUGGESTION_MARGIN_DB - marginDb)} dB en este tramo (nivel de ducking más profundo o música más baja).`,
    };
  }
  return marginDb < VOICE_MUSIC_SUGGESTION_MARGIN_DB
    ? { check: CHECK, severity: 'suggestion', message: `${message} Lo recomendable son ${String(VOICE_MUSIC_SUGGESTION_MARGIN_DB)} dB.`, timeRange }
    : null;
}

export function voiceMusicMarginFindings(margins: readonly SegmentMargin[]): FindingDraft[] {
  return margins.map(marginFinding).filter((finding): finding is FindingDraft => finding !== null);
}
