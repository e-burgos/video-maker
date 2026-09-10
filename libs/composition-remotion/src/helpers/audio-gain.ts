import type { Db, Frame, GainKeyframe } from '@video-maker/timeline-core';

export function gainDbToVolume(db: Db): number {
  return Math.min(1, Math.max(0, 10 ** (db / 20)));
}

export function volumeAtFrame(
  automation: readonly GainKeyframe[],
  frame: Frame,
  offsetDb: Db = 0,
): number {
  const first = automation[0];
  const last = automation[automation.length - 1];

  if (first === undefined || last === undefined) {
    return gainDbToVolume(offsetDb);
  }

  if (frame <= first.frame) {
    return gainDbToVolume(first.gainDb + offsetDb);
  }

  if (frame >= last.frame) {
    return gainDbToVolume(last.gainDb + offsetDb);
  }

  const nextIndex = automation.findIndex((keyframe) => keyframe.frame >= frame);
  const next = automation[nextIndex];
  const previous = automation[nextIndex - 1];

  if (next === undefined || previous === undefined) {
    return gainDbToVolume(last.gainDb + offsetDb);
  }

  const span = next.frame - previous.frame;
  const ratio = span === 0 ? 0 : (frame - previous.frame) / span;
  const gainDb = previous.gainDb + (next.gainDb - previous.gainDb) * ratio;

  return gainDbToVolume(gainDb + offsetDb);
}
