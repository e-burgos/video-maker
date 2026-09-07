import type { Fps, Frame, Ms, Rounding } from '../types/units';

const ROUND: Record<Rounding, (value: number) => number> = {
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

export function msToFrames(ms: Ms, fps: Fps, rounding: Rounding = 'round'): Frame {
  return ROUND[rounding]((ms * fps) / 1000);
}

export function framesToMs(frames: Frame, fps: Fps, rounding: Rounding = 'round'): Ms {
  return ROUND[rounding]((frames * 1000) / fps);
}
