import { MotionStudioError } from '../errors/motion-studio-error';
import type { Onset } from './parse-hyperframes-beats';

export interface BeatGrid {
  bpm: number;
  period: number;
  phase: number;
  confidence: number;
  beats: number[];
}

export interface FitBeatGridOptions {
  minBpm?: number;
  maxBpm?: number;
  bpmStep?: number;
}

interface Candidate {
  bpm: number;
  period: number;
  phase: number;
  confidence: number;
}

function scorePeriod(onsets: Onset[], totalStrength: number, bpm: number): Candidate {
  const period = 60 / bpm;
  let re = 0;
  let im = 0;
  for (const onset of onsets) {
    const angle = (2 * Math.PI * (onset.time % period)) / period;
    re += onset.strength * Math.cos(angle);
    im += onset.strength * Math.sin(angle);
  }
  const turn = Math.atan2(im, re) / (2 * Math.PI);
  const phase = (((turn % 1) + 1) % 1) * period;
  return { bpm, period, phase, confidence: Math.hypot(re, im) / totalStrength };
}

export function fitBeatGrid(onsets: Onset[], durationSec: number, opts: FitBeatGridOptions = {}): BeatGrid {
  const minBpm = opts.minBpm ?? 90;
  const maxBpm = opts.maxBpm ?? 140;
  const bpmStep = opts.bpmStep ?? 0.01;
  const totalStrength = onsets.reduce((sum, onset) => sum + onset.strength, 0);
  if (onsets.length < 4 || totalStrength <= 0) {
    throw new MotionStudioError('BEATS_INVALID', 'at least 4 onsets with strength are needed to fit a beat grid');
  }
  let best = scorePeriod(onsets, totalStrength, minBpm);
  const steps = Math.round((maxBpm - minBpm) / bpmStep);
  for (let step = 1; step <= steps; step++) {
    const candidate = scorePeriod(onsets, totalStrength, minBpm + step * bpmStep);
    if (candidate.confidence > best.confidence) best = candidate;
  }
  const beats: number[] = [];
  for (let t = best.phase; t <= durationSec + 1e-9; t += best.period) beats.push(Math.round(t * 1000) / 1000);
  return {
    bpm: Math.round(best.bpm * 100) / 100,
    period: Math.round(best.period * 10000) / 10000,
    phase: Math.round(best.phase * 1000) / 1000,
    confidence: Math.round(best.confidence * 1000) / 1000,
    beats,
  };
}
