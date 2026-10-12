import type { ReferenceBrief, ReferenceJob, ReferenceSummary } from '../reference-types';

export function referenceBrief(overrides: Partial<ReferenceBrief> = {}): ReferenceBrief {
  return {
    version: 1,
    file: 'raw/reference/demo.mp4',
    durationSec: 42.3,
    format: { width: 1080, height: 1920, fps: 30, orientation: 'portrait' },
    scenes: [
      { index: 0, startSec: 0, endSec: 3.2, durationSec: 3.2, keyframe: 'work/reference/demo/scene-00.jpg' },
      { index: 1, startSec: 3.2, endSec: 9.7, durationSec: 6.5, keyframe: 'work/reference/demo/scene-01.jpg' },
    ],
    pace: { cutsPerMinute: 14.2, meanSceneSec: 4.9, medianSceneSec: 4.4 },
    voice: {
      transcript: [
        { startSec: 0.5, endSec: 2.9, text: 'Hola, hoy te muestro algo.' },
        { startSec: 65, endSec: 68, text: 'Y listo.' },
      ],
      wordsPerMinute: 148,
      speechRatio: 0.72,
    },
    audio: { integratedLufs: -15.4, longSilences: [{ startSec: 20, endSec: 22.5 }] },
    summary: '2 escenas, 14.2 cortes por minuto.',
    createdAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

export function referenceSummary(overrides: Partial<ReferenceSummary> = {}): ReferenceSummary {
  return {
    name: 'demo',
    file: 'raw/reference/demo.mp4',
    briefFile: 'work/reference/demo.brief.json',
    durationSec: 42.3,
    scenes: 2,
    cutsPerMinute: 14.2,
    hasVoice: true,
    summary: '2 escenas, 14.2 cortes por minuto.',
    createdAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

export function referenceJob(overrides: Partial<ReferenceJob> = {}): ReferenceJob {
  return {
    id: 'ref-1',
    kind: 'reference',
    slug: 'demo-01',
    state: 'running',
    createdAt: '2026-10-12T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    progress: { stage: 'scenes', percent: 20 },
    report: null,
    error: null,
    ...overrides,
  };
}
