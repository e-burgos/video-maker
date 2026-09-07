import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import {
  CATALOG_SCHEMA_VERSION,
  CatalogAssetSchema,
  CatalogSchema,
  IgnoredEntrySchema,
  ProbeFailureSchema,
  ProjectRelativePathSchema,
  TranscriptRefSchema,
} from './catalog.schema';

function videoAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'raw/aroll/clip01.mp4',
    kind: 'video',
    path: 'raw/aroll/clip01.mp4',
    durationMs: 10_000,
    fps: 30,
    width: 1920,
    height: 1080,
    hasAudio: true,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function audioAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'raw/audio/music01.mp3',
    kind: 'audio',
    path: 'raw/audio/music01.mp3',
    durationMs: 20_000,
    hasAudio: true,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectRelativePathSchema', () => {
  it('acepta una ruta relativa POSIX válida', () => {
    expect(ProjectRelativePathSchema.safeParse('raw/aroll/clip01.mp4').success).toBe(true);
  });

  it('rechaza una ruta absoluta POSIX', () => {
    expect(ProjectRelativePathSchema.safeParse('/raw/aroll/clip01.mp4').success).toBe(false);
  });

  it('rechaza una ruta con letra de unidad de Windows', () => {
    expect(ProjectRelativePathSchema.safeParse('C:\\raw\\clip01.mp4').success).toBe(false);
  });

  it('rechaza una ruta con separador de Windows sin letra de unidad', () => {
    expect(ProjectRelativePathSchema.safeParse('raw\\aroll\\clip01.mp4').success).toBe(false);
  });

  it('rechaza un esquema de URL', () => {
    expect(ProjectRelativePathSchema.safeParse('file:///raw/aroll/clip01.mp4').success).toBe(false);
  });

  it('rechaza una ruta que escapa con ..', () => {
    expect(ProjectRelativePathSchema.safeParse('raw/../../../etc/passwd').success).toBe(false);
    expect(ProjectRelativePathSchema.safeParse('../secret').success).toBe(false);
  });
});

describe('CatalogAssetSchema', () => {
  it('acepta un asset cuyo id coincide con su path', () => {
    const result = CatalogAssetSchema.safeParse({
      role: 'aroll',
      fingerprint: { sizeBytes: 1024, modifiedAtMs: 1_000 },
      asset: videoAsset(),
    });

    expect(result.success).toBe(true);
  });

  it('rechaza un asset cuyo id no coincide con su path', () => {
    const result = CatalogAssetSchema.safeParse({
      role: 'aroll',
      fingerprint: { sizeBytes: 1024, modifiedAtMs: 1_000 },
      asset: videoAsset({ id: 'raw/aroll/otro.mp4' }),
    });

    expect(result.success).toBe(false);
  });
});

describe('TranscriptRefSchema', () => {
  it('acepta una referencia de transcripción válida', () => {
    const result = TranscriptRefSchema.safeParse({
      assetId: 'raw/aroll/clip01.mp4',
      transcriptPath: 'work/transcripts/aroll/clip01.json',
      fingerprint: { sizeBytes: 1024, modifiedAtMs: 1_000 },
      engine: 'whisper.cpp',
      model: 'ggml-base.bin',
      language: 'es',
    });

    expect(result.success).toBe(true);
  });
});

describe('IgnoredEntrySchema', () => {
  it.each([
    'hidden',
    'unsupported-extension',
    'unknown-directory',
    'unexpected-file',
    'extension-role-mismatch',
  ])('acepta reason "%s"', (reason) => {
    expect(IgnoredEntrySchema.safeParse({ path: 'raw/aroll/x', reason }).success).toBe(true);
  });
});

describe('ProbeFailureSchema', () => {
  it.each(['BINARY_NOT_FOUND', 'COMMAND_FAILED', 'UNPARSEABLE_OUTPUT', 'UNKNOWN'])(
    'acepta errorCode "%s"',
    (errorCode) => {
      expect(
        ProbeFailureSchema.safeParse({ path: 'raw/aroll/x', errorCode, message: 'boom' }).success,
      ).toBe(true);
    },
  );
});

function baseCatalog(): {
  schemaVersion: number;
  projectSlug: string;
  assets: unknown[];
  transcripts: unknown[];
  ignored: unknown[];
  probeFailures: unknown[];
} {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: 'pitch-deck',
    assets: [
      { role: 'aroll', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 }, asset: videoAsset() },
      {
        role: 'audio',
        fingerprint: { sizeBytes: 20, modifiedAtMs: 2 },
        asset: audioAsset(),
      },
    ],
    transcripts: [
      {
        assetId: 'raw/aroll/clip01.mp4',
        transcriptPath: 'work/transcripts/aroll/clip01.json',
        fingerprint: { sizeBytes: 10, modifiedAtMs: 1 },
        engine: 'whisper.cpp',
        model: 'ggml-base.bin',
        language: 'es',
      },
    ],
    ignored: [{ path: 'raw/aroll/.DS_Store', reason: 'hidden' }],
    probeFailures: [{ path: 'raw/broll/broken.mov', errorCode: 'COMMAND_FAILED', message: 'boom' }],
  };
}

describe('CatalogSchema', () => {
  it('acepta un catalogo valido y ordenado', () => {
    const result = CatalogSchema.safeParse(baseCatalog());
    expect(result.success).toBe(true);
  });

  it('rechaza un schemaVersion distinto al vigente', () => {
    const catalog = { ...baseCatalog(), schemaVersion: 2 };
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('no permite un campo generatedAt ni ningun otro campo fuera del schema', () => {
    const catalog = { ...baseCatalog(), generatedAt: '2026-01-01T00:00:00.000Z' };
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza assets con ids duplicados', () => {
    const catalog = baseCatalog();
    catalog.assets = [catalog.assets[0], catalog.assets[0]];
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza assets fuera de orden ascendente', () => {
    const catalog = baseCatalog();
    catalog.assets = [...catalog.assets].reverse();
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza un transcript que referencia un assetId inexistente', () => {
    const catalog = baseCatalog();
    catalog.transcripts = [{ ...(catalog.transcripts[0] as object), assetId: 'raw/aroll/no-existe.mp4' }];
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza un transcript que referencia un asset cuyo role no es aroll', () => {
    const catalog = baseCatalog();
    catalog.transcripts = [{ ...(catalog.transcripts[0] as object), assetId: 'raw/audio/music01.mp3' }];
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza ignored fuera de orden ascendente', () => {
    const catalog = baseCatalog();
    catalog.ignored = [
      { path: 'raw/z', reason: 'hidden' },
      { path: 'raw/a', reason: 'hidden' },
    ];
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('rechaza probeFailures con paths duplicados', () => {
    const catalog = baseCatalog();
    catalog.probeFailures = [catalog.probeFailures[0], catalog.probeFailures[0]];
    expect(CatalogSchema.safeParse(catalog).success).toBe(false);
  });

  it('produce el mismo JSON serializado sin importar el orden de claves de entrada', () => {
    const catalog = baseCatalog();
    const reorderedCatalog = {
      probeFailures: catalog.probeFailures,
      ignored: catalog.ignored,
      transcripts: catalog.transcripts,
      assets: catalog.assets,
      projectSlug: catalog.projectSlug,
      schemaVersion: catalog.schemaVersion,
    };

    const parsedA = CatalogSchema.parse(catalog);
    const parsedB = CatalogSchema.parse(reorderedCatalog);

    expect(JSON.stringify(parsedA)).toBe(JSON.stringify(parsedB));
    expect(Object.keys(parsedA)).toEqual([
      'schemaVersion',
      'projectSlug',
      'assets',
      'transcripts',
      'ignored',
      'probeFailures',
    ]);
  });
});
