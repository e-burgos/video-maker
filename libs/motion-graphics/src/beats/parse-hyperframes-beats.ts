import { MotionStudioError } from '../errors/motion-studio-error';

export interface Onset {
  time: number;
  strength: number;
}

export function parseHyperframesBeats(json: string): Onset[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new MotionStudioError('BEATS_INVALID', 'beats file is not valid JSON');
  }
  const beats = (parsed as { beats?: unknown } | null)?.beats;
  if (!Array.isArray(beats)) throw new MotionStudioError('BEATS_INVALID', 'beats file has no "beats" array');
  return beats.map((beat, index) => {
    const { time, strength } = (beat ?? {}) as { time?: unknown; strength?: unknown };
    if (typeof time !== 'number' || typeof strength !== 'number' || time < 0 || strength < 0) {
      throw new MotionStudioError('BEATS_INVALID', `beats[${index}] must have non-negative time and strength`);
    }
    return { time, strength };
  });
}
