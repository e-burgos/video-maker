const SILENT_VOLUME_FLOOR = 1e-6;
export const GAIN_SAMPLES_PER_SEGMENT = 8;

export function sampleTimes(startSec: number, endSec: number): number[] {
  const step = (endSec - startSec) / GAIN_SAMPLES_PER_SEGMENT;
  return Array.from({ length: GAIN_SAMPLES_PER_SEGMENT + 1 }, (_, index) => startSec + step * index);
}

export function meanPowerDb(volumes: readonly number[]): number {
  const meanSquare = volumes.reduce((sum, volume) => sum + volume * volume, 0) / volumes.length;
  return 10 * Math.log10(Math.max(meanSquare, SILENT_VOLUME_FLOOR * SILENT_VOLUME_FLOOR));
}
