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

const REGULAR_TRAIN_TOLERANCE = 0.04;
const REGULAR_TRAIN_MIN_SHARE = 0.8;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function leastSquaresInterval(onsets: Onset[], roughInterval: number): number {
  const first = onsets[0]?.time ?? 0;
  const points = onsets.map((onset) => ({ index: Math.round((onset.time - first) / roughInterval), time: onset.time }));
  const meanIndex = points.reduce((sum, p) => sum + p.index, 0) / points.length;
  const meanTime = points.reduce((sum, p) => sum + p.time, 0) / points.length;
  const covariance = points.reduce((sum, p) => sum + (p.index - meanIndex) * (p.time - meanTime), 0);
  const variance = points.reduce((sum, p) => sum + (p.index - meanIndex) ** 2, 0);
  return variance > 0 ? covariance / variance : roughInterval;
}

function fitRegularTrain(onsets: Onset[], minBpm: number, maxBpm: number): Candidate | null {
  const intervals = onsets.slice(1).map((onset, i) => onset.time - (onsets[i]?.time ?? 0));
  const typical = median(intervals);
  if (typical <= 0) return null;
  const regularShare = intervals.filter((interval) => Math.abs(interval - typical) <= typical * REGULAR_TRAIN_TOLERANCE).length / intervals.length;
  if (regularShare < REGULAR_TRAIN_MIN_SHARE) return null;
  const interval = leastSquaresInterval(onsets, typical);
  let subdivisions = 1;
  while (60 / (interval * subdivisions) > maxBpm) subdivisions *= 2;
  const period = interval * subdivisions;
  const bpm = 60 / period;
  if (bpm < minBpm) return null;
  const first = onsets[0]?.time ?? 0;
  const strengthByOffset = Array.from({ length: subdivisions }, (_, offset) =>
    onsets.filter((onset) => Math.round((onset.time - first) / interval) % subdivisions === offset).reduce((sum, onset) => sum + onset.strength, 0),
  );
  const strongestOffset = strengthByOffset.indexOf(Math.max(...strengthByOffset));
  const phase = (((first + strongestOffset * interval) % period) + period) % period;
  return { bpm, period, phase, confidence: regularShare };
}

function gridFrom(best: Candidate, durationSec: number): BeatGrid {
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

export function fitBeatGrid(onsets: Onset[], durationSec: number, opts: FitBeatGridOptions = {}): BeatGrid {
  const minBpm = opts.minBpm ?? 90;
  const maxBpm = opts.maxBpm ?? 140;
  const bpmStep = opts.bpmStep ?? 0.01;
  const totalStrength = onsets.reduce((sum, onset) => sum + onset.strength, 0);
  if (onsets.length < 4 || totalStrength <= 0) {
    throw new MotionStudioError('BEATS_INVALID', 'at least 4 onsets with strength are needed to fit a beat grid');
  }
  const regular = fitRegularTrain(onsets, minBpm, maxBpm);
  if (regular !== null) return gridFrom(regular, durationSec);
  let best = scorePeriod(onsets, totalStrength, minBpm);
  const steps = Math.round((maxBpm - minBpm) / bpmStep);
  for (let step = 1; step <= steps; step++) {
    const candidate = scorePeriod(onsets, totalStrength, minBpm + step * bpmStep);
    if (candidate.confidence > best.confidence) best = candidate;
  }
  return gridFrom(best, durationSec);
}
