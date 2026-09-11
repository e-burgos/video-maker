import { describe, expect, it } from 'vitest';

import { formatReport } from './format-report';
import type { IngestReport, PlanReport, RenderReport, RunReport } from './cli-report';

const INGEST_REPORT: IngestReport = {
  kind: 'ingest',
  catalogPath: 'work/catalog.json',
  assetCounts: [
    { role: 'aroll', count: 1 },
    { role: 'broll', count: 1 },
    { role: 'image', count: 1 },
    { role: 'audio', count: 1 },
  ],
  transcribedCount: 1,
  reusedTranscriptionCount: 0,
  probeFailurePaths: [],
  transcriptionFailures: [],
  staleCatalogReplaced: false,
};

const INGEST_REPORT_WITH_PARTIAL_FAILURES: IngestReport = {
  kind: 'ingest',
  catalogPath: 'work/catalog.json',
  assetCounts: [
    { role: 'aroll', count: 1 },
    { role: 'broll', count: 2 },
    { role: 'image', count: 1 },
    { role: 'audio', count: 1 },
  ],
  transcribedCount: 1,
  reusedTranscriptionCount: 0,
  probeFailurePaths: ['raw/broll/clip09.mp4'],
  transcriptionFailures: [{ assetId: 'raw/aroll/clip02.mp4', failedStage: 'transcribe' }],
  staleCatalogReplaced: false,
};

const PLAN_REPORT: PlanReport = {
  kind: 'plan',
  format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
  timelinePath: 'work/timeline.json',
  edlPath: 'work/edl.json',
  editedDurationMs: 18540,
  transcriptionSource: 'catalog',
  conceptTerms: ['comando', 'deploy'],
  brollOverlayCount: 3,
  brollRejections: [{ conceptTerm: 'deploy', startMs: 12400, reason: 'punch-in-overlap' }],
  logoAssetId: null,
  scriptAlignment: null,
};

const RENDER_REPORT: RenderReport = {
  kind: 'render',
  outPath: 'out/smoke-ingest.mp4',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 556,
  mutedVideoPath: 'work/renders/smoke-ingest/video-muted.mp4',
  masterAudioPath: 'work/renders/smoke-ingest/master.wav',
  loudness: {
    withinTolerance: true,
    integratedLufs: -14.2,
    truePeakDbtp: -1.4,
    integratedDeltaLu: 0.2,
    truePeakDeltaDb: 0.1,
  },
};

describe('formatReport — ingest', () => {
  it('formats the ok block with the four roles always present, even at zero', () => {
    expect(formatReport(INGEST_REPORT)).toEqual([
      'ok [ingest] work/catalog.json',
      '  assets: aroll=1 broll=1 image=1 audio=1',
      '  transcribed: 1 (reused 0)',
      '  probe-failures: 0',
      '  transcription-failures: 0',
    ]);
  });

  it('lists partial failures without changing the exit code contract (RN-27)', () => {
    expect(formatReport(INGEST_REPORT_WITH_PARTIAL_FAILURES)).toEqual([
      'ok [ingest] work/catalog.json',
      '  assets: aroll=1 broll=2 image=1 audio=1',
      '  transcribed: 1 (reused 0)',
      '  probe-failures: 1',
      '    raw/broll/clip09.mp4',
      '  transcription-failures: 1',
      '    raw/aroll/clip02.mp4 (transcribe)',
    ]);
  });

  it('appends stale-catalog-replaced only when true', () => {
    expect(formatReport({ ...INGEST_REPORT, staleCatalogReplaced: true })).toEqual([
      'ok [ingest] work/catalog.json',
      '  assets: aroll=1 broll=1 image=1 audio=1',
      '  transcribed: 1 (reused 0)',
      '  probe-failures: 0',
      '  transcription-failures: 0',
      '  stale-catalog-replaced: yes',
    ]);
  });
});

describe('formatReport — plan', () => {
  it('formats the ok block with concepts and broll rejections (RN-28)', () => {
    expect(formatReport(PLAN_REPORT)).toEqual([
      'ok [plan] work/timeline.json',
      '  format: reels-9x16 1080x1920@30',
      '  edl: work/edl.json',
      '  edited-duration-ms: 18540',
      '  transcription-source: catalog',
      '  concepts: 2',
      '    comando',
      '    deploy',
      '  broll-overlays: 3',
      '  broll-rejections: 1',
      '    deploy@12400ms punch-in-overlap',
      '  logo: none',
    ]);
  });

  it('nombra el logo y las correcciones del guion cuando el plan las trae (spec-014)', () => {
    const lines = formatReport({
      ...PLAN_REPORT,
      logoAssetId: 'raw/logo/brand.png',
      scriptAlignment: { replaced: 4, removed: 2, inserted: 1, dropped: 0, corrected: 7 },
    });

    expect(lines).toContain('  logo: raw/logo/brand.png');
    expect(lines).toContain('  script-corrections: 7');
    expect(lines).toContain('    replaced: 4 removed: 2 inserted: 1 dropped: 0');
  });
});

describe('formatReport — render', () => {
  it('formats the ok block with format and frames', () => {
    expect(formatReport(RENDER_REPORT)).toEqual([
      'ok [render] out/smoke-ingest.mp4',
      '  format: 1080x1920@30',
      '  frames: 556',
      '  muted-video: work/renders/smoke-ingest/video-muted.mp4',
      '  master-audio: work/renders/smoke-ingest/master.wav',
      '  loudness: -14.2 LUFS / -1.4 dBTP (within tolerance)',
    ]);
  });

  it('grita cuando la mezcla quedó fuera de tolerancia', () => {
    expect(
      formatReport({
        ...RENDER_REPORT,
        loudness: { ...RENDER_REPORT.loudness, withinTolerance: false, integratedLufs: -11 },
      }),
    ).toContain('  loudness: -11 LUFS / -1.4 dBTP (OUT OF TOLERANCE)');
  });
});

describe('formatReport — run', () => {
  it('is the exact concatenation of the three blocks, in order, with no header of its own', () => {
    const runReport: RunReport = {
      kind: 'run',
      ingest: INGEST_REPORT,
      plan: PLAN_REPORT,
      render: RENDER_REPORT,
    };

    expect(formatReport(runReport)).toEqual([
      ...formatReport(INGEST_REPORT),
      ...formatReport(PLAN_REPORT),
      ...formatReport(RENDER_REPORT),
    ]);
  });
});
