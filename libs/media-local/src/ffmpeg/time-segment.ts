export interface TimeSegment {
  readonly startSec: number;
  readonly endSec: number;
}

export interface DetectedSegment extends TimeSegment {
  readonly durationSec: number;
}

export function toDetectedSegment(startSec: number, endSec: number): DetectedSegment {
  return { startSec, endSec, durationSec: roundToMillis(endSec - startSec) };
}

function roundToMillis(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}
