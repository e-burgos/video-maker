import type { Db } from '@video-maker/timeline-core';

export function gainDbToVolume(db: Db): number {
  return Math.min(1, Math.max(0, 10 ** (db / 20)));
}
