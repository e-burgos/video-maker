import type { JobRecord } from '@video-maker/local-store';

import type { HistorySample } from './estimate-production';

export const HISTORY_JOB_KINDS = ['render', 'motion', 'voice'] as const;
export const HISTORY_ROW_LIMIT = 300;

const MS_PER_SECOND = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function processSecondsOf(row: JobRecord): number | null {
  if (row.startedAt === null || row.finishedAt === null) {
    return null;
  }
  const seconds = (Date.parse(row.finishedAt) - Date.parse(row.startedAt)) / MS_PER_SECOND;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function renderSample(row: JobRecord, report: Record<string, unknown>, processSec: number): HistorySample | null {
  const deliverable = report.deliverable;
  if (!isRecord(deliverable) || !isPositiveNumber(deliverable.durationInFrames) || !isPositiveNumber(deliverable.fps)) {
    return null;
  }
  const timeline = isRecord(row.params) ? row.params.timeline : undefined;
  const format = isRecord(timeline) && isRecord(timeline.format) ? timeline.format.preset : undefined;
  return {
    kind: 'render',
    mode: 'footage',
    format: typeof format === 'string' ? format : null,
    mediaSec: deliverable.durationInFrames / deliverable.fps,
    processSec,
    finishedAt: row.finishedAt ?? '',
  };
}

function motionSample(row: JobRecord, report: Record<string, unknown>, processSec: number): HistorySample | null {
  if (!isPositiveNumber(report.durationSec)) {
    return null;
  }
  return { kind: 'render', mode: 'motion', format: null, mediaSec: report.durationSec, processSec, finishedAt: row.finishedAt ?? '' };
}

function voiceMediaSeconds(report: Record<string, unknown>): number | null {
  const track = report.track;
  if (isRecord(track) && isPositiveNumber(track.durationMs)) {
    return track.durationMs / MS_PER_SECOND;
  }
  const scenes = report.scenes;
  if (!Array.isArray(scenes)) {
    return null;
  }
  const totalMs = scenes.reduce<number>(
    (sum, scene) => sum + (isRecord(scene) && isPositiveNumber(scene.durationMs) ? scene.durationMs : 0),
    0,
  );
  return totalMs > 0 ? totalMs / MS_PER_SECOND : null;
}

function voiceSample(row: JobRecord, report: Record<string, unknown>, processSec: number): HistorySample | null {
  const mediaSec = voiceMediaSeconds(report);
  return mediaSec === null ? null : { kind: 'voice', mode: null, format: null, mediaSec, processSec, finishedAt: row.finishedAt ?? '' };
}

export function historySampleFrom(row: JobRecord): HistorySample | null {
  const processSec = processSecondsOf(row);
  if (row.state !== 'succeeded' || processSec === null || !isRecord(row.report) || row.report.sample === true) {
    return null;
  }
  switch (row.kind) {
    case 'render':
      return renderSample(row, row.report, processSec);
    case 'motion':
      return motionSample(row, row.report, processSec);
    case 'voice':
      return voiceSample(row, row.report, processSec);
    default:
      return null;
  }
}

export function historySamplesFrom(rows: readonly JobRecord[]): readonly HistorySample[] {
  return rows.flatMap((row) => {
    const sample = historySampleFrom(row);
    return sample === null ? [] : [sample];
  });
}
