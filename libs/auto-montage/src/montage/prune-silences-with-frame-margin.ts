import type { CutRange, Fps, KeepRange, MediaAsset, Transcription } from '@video-maker/timeline-core';
import { detectSilencesFromWords, framesToMs, pruneSilences } from '@video-maker/timeline-core';

import { MontageInputError } from '../errors/montage-input-error';
import type { MontagePreset } from '../presets/montage-preset';

export interface PruneSilencesWithFrameMarginResult {
  readonly pruneDurationMs: number;
  readonly keeps: readonly KeepRange[];
  readonly cuts: readonly CutRange[];
}

export function pruneSilencesWithFrameMargin(
  projectRoot: string,
  arollAsset: MediaAsset,
  transcription: Transcription,
  preset: MontagePreset,
  fps: Fps,
): PruneSilencesWithFrameMarginResult {
  const frameMs = framesToMs(1, fps, 'ceil');
  if (arollAsset.durationMs <= frameMs) {
    throw new MontageInputError({ projectRoot, reason: 'empty-aroll' });
  }

  const pruneDurationMs = Math.max(1, arollAsset.durationMs - frameMs);

  const silences = detectSilencesFromWords(transcription, {
    minSilenceMs: preset.silence.minSilenceMs,
  });
  const { keeps, cuts } = pruneSilences(pruneDurationMs, silences, {
    paddingMs: preset.silence.paddingMs,
    minKeepMs: preset.silence.minKeepMs,
  });

  return { pruneDurationMs, keeps, cuts };
}
