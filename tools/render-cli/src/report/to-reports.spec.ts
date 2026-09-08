import { AssetProbeFailedError, TranscriptionFailedError } from '@video-maker/auto-montage';
import type { AssetRole, AutoMontageResult, Catalog, CatalogAsset, IngestResult } from '@video-maker/auto-montage';
import type { Concept } from '@video-maker/auto-montage';
import type { BrollOverlayPlan, BrollRejection } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { fixtureMediaProject } from '../__fixtures__/media-project';
import type { RenderOutcome } from '../deps/timeline-renderer';

import { toIngestReport, toPlanReport, toRenderReport } from './to-reports';

function catalogAsset(role: AssetRole, index: number): CatalogAsset {
  const path = `raw/${role}/clip${index}.mp4`;
  return {
    role,
    fingerprint: { sizeBytes: 1, modifiedAtMs: 0 },
    asset: { id: path, kind: 'video', path, durationMs: 1000, probedAt: '2026-01-01T00:00:00.000Z' },
  };
}

function catalogWith(assets: readonly CatalogAsset[]): Catalog {
  return { schemaVersion: 1, projectSlug: 'p', assets, transcripts: [], ignored: [], probeFailures: [] };
}

describe('toIngestReport', () => {
  it('counts assets by role in the fixed aroll/broll/image/audio order, even at zero', () => {
    const result: IngestResult = {
      catalog: catalogWith([catalogAsset('aroll', 1), catalogAsset('image', 1)]),
      catalogPath: 'work/catalog.json',
      probeFailures: [],
      transcriptionFailures: [],
      transcribedAssetIds: ['raw/aroll/clip1.mp4'],
      reusedTranscriptionAssetIds: [],
      reusedProbeAssetIds: [],
      staleCatalogReplaced: false,
    };

    const report = toIngestReport(result);

    expect(report.assetCounts).toEqual([
      { role: 'aroll', count: 1 },
      { role: 'broll', count: 0 },
      { role: 'image', count: 1 },
      { role: 'audio', count: 0 },
    ]);
    expect(report.catalogPath).toBe('work/catalog.json');
    expect(report.transcribedCount).toBe(1);
    expect(report.reusedTranscriptionCount).toBe(0);
    expect(report.staleCatalogReplaced).toBe(false);
  });

  it('sorts probe failure paths ascending and renames the transcription failure stage to failedStage', () => {
    const result: IngestResult = {
      catalog: catalogWith([]),
      catalogPath: 'work/catalog.json',
      probeFailures: [
        new AssetProbeFailedError({ path: 'raw/broll/clip09.mp4' }),
        new AssetProbeFailedError({ path: 'raw/aroll/clip02.mp4' }),
      ],
      transcriptionFailures: [
        new TranscriptionFailedError({ assetId: 'raw/aroll/clip02.mp4', stage: 'transcribe' }),
      ],
      transcribedAssetIds: [],
      reusedTranscriptionAssetIds: [],
      reusedProbeAssetIds: [],
      staleCatalogReplaced: true,
    };

    const report = toIngestReport(result);

    expect(report.probeFailurePaths).toEqual(['raw/aroll/clip02.mp4', 'raw/broll/clip09.mp4']);
    expect(report.transcriptionFailures).toEqual([{ assetId: 'raw/aroll/clip02.mp4', failedStage: 'transcribe' }]);
    expect(report.staleCatalogReplaced).toBe(true);
  });
});

describe('toPlanReport', () => {
  it('maps concepts, broll overlay count and broll rejections', () => {
    const concepts: readonly Concept[] = [
      { term: 'comando', source: 'dictionary', occurrences: [] },
      { term: 'deploy', source: 'dictionary', occurrences: [] },
    ];
    const brollOverlays: readonly BrollOverlayPlan[] = [
      { id: 'overlay-1', startMs: 0, endMs: 1000, assetId: 'raw/broll/clip01.mp4', fit: 'cover', keepVoice: true },
    ];
    const brollRejections: readonly BrollRejection[] = [
      { conceptTerm: 'deploy', startMs: 12400, assetId: null, reason: 'punch-in-overlap' },
    ];

    const result: AutoMontageResult = {
      edl: {} as AutoMontageResult['edl'],
      timeline: {} as AutoMontageResult['timeline'],
      concepts,
      brollOverlays,
      brollRejections,
      transcriptionSource: 'catalog',
      stopwordLanguage: 'es',
      editedDurationMs: 18540,
      edlPath: 'work/edl.json',
      timelinePath: 'work/timeline.json',
    };

    const report = toPlanReport(result);

    expect(report).toEqual({
      kind: 'plan',
      timelinePath: 'work/timeline.json',
      edlPath: 'work/edl.json',
      editedDurationMs: 18540,
      transcriptionSource: 'catalog',
      conceptTerms: ['comando', 'deploy'],
      brollOverlayCount: 1,
      brollRejections: [{ conceptTerm: 'deploy', startMs: 12400, reason: 'punch-in-overlap' }],
    });
  });
});

describe('toRenderReport', () => {
  it('relativizes outPath against the project root and keeps the render metrics', () => {
    const outcome: RenderOutcome = {
      outPath: `${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 556,
    };

    const report = toRenderReport(outcome, fixtureMediaProject);

    expect(report).toEqual({
      kind: 'render',
      outPath: `out/${fixtureMediaProject.slug}.mp4`,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 556,
    });
  });
});
