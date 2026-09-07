import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import type { Catalog } from '../catalog/catalog.schema';
import { CATALOG_SCHEMA_VERSION } from '../catalog/catalog.schema';
import type { AssetFinding } from './discover-assets';
import { planIngestWork } from './plan-ingest-work';
import type { PlanIngestWorkOptions } from './plan-ingest-work';

const options: PlanIngestWorkOptions = {
  engine: 'whisper.cpp',
  model: 'ggml-base.bin',
  language: 'es',
  transcribeRoles: ['aroll'],
};

const arollAsset: MediaAsset = {
  id: 'raw/aroll/clip01.mp4',
  kind: 'video',
  path: 'raw/aroll/clip01.mp4',
  durationMs: 10_000,
  fps: 30,
  width: 1920,
  height: 1080,
  hasAudio: true,
  probedAt: '2026-01-01T00:00:00.000Z',
};

function finding(overrides: Partial<AssetFinding> = {}): AssetFinding {
  return {
    relativePath: 'raw/aroll/clip01.mp4',
    role: 'aroll',
    fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
    ...overrides,
  };
}

function catalogWith(overrides: Partial<Catalog> = {}): Catalog {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: 'pitch-deck',
    assets: [{ role: 'aroll', fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 }, asset: arollAsset }],
    transcripts: [
      {
        assetId: 'raw/aroll/clip01.mp4',
        transcriptPath: 'work/transcripts/aroll/clip01.json',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
        engine: 'whisper.cpp',
        model: 'ggml-base.bin',
        language: 'es',
      },
    ],
    ignored: [],
    probeFailures: [],
    ...overrides,
  };
}

describe('planIngestWork — sin catálogo previo', () => {
  it('no reusa ningún probe ni ninguna transcripción', () => {
    const result = planIngestWork([finding()], null, options);

    expect(result.assetPlans).toEqual([{ finding: finding(), reuse: undefined }]);
    expect(result.transcriptionPlans).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
        reuseCandidate: undefined,
      },
    ]);
  });
});

describe('planIngestWork — reuso de probe', () => {
  it('CA-004 (probe): reusa el CatalogAsset previo si el fingerprint no cambió', () => {
    const previousCatalog = catalogWith();

    const result = planIngestWork([finding()], previousCatalog, options);

    expect(result.assetPlans).toEqual([{ finding: finding(), reuse: previousCatalog.assets[0] }]);
  });

  it('CA-005 (probe): invalida el reuso si cambió el tamaño', () => {
    const previousCatalog = catalogWith();
    const changedFinding = finding({ fingerprint: { sizeBytes: 2_000, modifiedAtMs: 1_000 } });

    const result = planIngestWork([changedFinding], previousCatalog, options);

    expect(result.assetPlans).toEqual([{ finding: changedFinding, reuse: undefined }]);
  });

  it('CA-005 (probe): invalida el reuso si cambió el mtime', () => {
    const previousCatalog = catalogWith();
    const changedFinding = finding({ fingerprint: { sizeBytes: 1_000, modifiedAtMs: 2_000 } });

    const result = planIngestWork([changedFinding], previousCatalog, options);

    expect(result.assetPlans).toEqual([{ finding: changedFinding, reuse: undefined }]);
  });
});

describe('planIngestWork — reuso de transcripción', () => {
  it('CA-004 (transcripción): con metadata sin cambios, la decisión es reusar (no re-transcribir)', () => {
    const previousCatalog = catalogWith();

    const result = planIngestWork([finding()], previousCatalog, options);

    expect(result.transcriptionPlans).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
        reuseCandidate: previousCatalog.transcripts[0],
      },
    ]);
  });

  it('CA-005 (transcripción): un tamaño distinto invalida y dispara re-transcripción solo de ese clip', () => {
    const previousCatalog = catalogWith();
    const changedClip = finding({
      relativePath: 'raw/aroll/clip01.mp4',
      fingerprint: { sizeBytes: 9_999, modifiedAtMs: 1_000 },
    });
    const unchangedClip = finding({
      relativePath: 'raw/aroll/clip02.mp4',
      fingerprint: { sizeBytes: 500, modifiedAtMs: 500 },
    });
    const catalogWithTwoClips = catalogWith({
      transcripts: [
        ...previousCatalog.transcripts,
        {
          assetId: 'raw/aroll/clip02.mp4',
          transcriptPath: 'work/transcripts/aroll/clip02.json',
          fingerprint: { sizeBytes: 500, modifiedAtMs: 500 },
          engine: 'whisper.cpp',
          model: 'ggml-base.bin',
          language: 'es',
        },
      ],
    });

    const result = planIngestWork([changedClip, unchangedClip], catalogWithTwoClips, options);

    expect(result.transcriptionPlans).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        fingerprint: { sizeBytes: 9_999, modifiedAtMs: 1_000 },
        reuseCandidate: undefined,
      },
      {
        assetId: 'raw/aroll/clip02.mp4',
        fingerprint: { sizeBytes: 500, modifiedAtMs: 500 },
        reuseCandidate: catalogWithTwoClips.transcripts[1],
      },
    ]);
  });

  it('CA-005 (transcripción): un mtime distinto invalida el reuso', () => {
    const previousCatalog = catalogWith();
    const changedFinding = finding({ fingerprint: { sizeBytes: 1_000, modifiedAtMs: 2_000 } });

    const result = planIngestWork([changedFinding], previousCatalog, options);

    expect(result.transcriptionPlans).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 2_000 },
        reuseCandidate: undefined,
      },
    ]);
  });

  it('un cambio de modelo invalida el reuso aunque el fingerprint no cambió', () => {
    const previousCatalog = catalogWith();

    const result = planIngestWork([finding()], previousCatalog, {
      ...options,
      model: 'ggml-large-v3-turbo-q5_0.bin',
    });

    expect(result.transcriptionPlans).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
        reuseCandidate: undefined,
      },
    ]);
  });

  it('solo planifica transcripción para los roles indicados en transcribeRoles', () => {
    const brollFinding = finding({ relativePath: 'raw/broll/clip01.mp4', role: 'broll' });

    const result = planIngestWork([brollFinding], null, options);

    expect(result.transcriptionPlans).toEqual([]);
    expect(result.assetPlans).toEqual([{ finding: brollFinding, reuse: undefined }]);
  });
});
