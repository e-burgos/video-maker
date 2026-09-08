import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import type { Catalog, CatalogAsset } from '../catalog/catalog.schema';
import { softwareDemoPreset } from '../presets/software-demo.preset';
import type { MontagePreset } from '../presets/montage-preset';
import { buildBrollIndex } from './build-broll-index';

function mediaAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path' | 'kind'>): MediaAsset {
  return {
    durationMs: 5000,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function catalogAsset(role: CatalogAsset['role'], asset: MediaAsset): CatalogAsset {
  return {
    role,
    fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
    asset,
  };
}

function catalogOf(assets: readonly CatalogAsset[]): Catalog {
  return {
    schemaVersion: 1,
    projectSlug: 'demo-project',
    assets: [...assets],
    transcripts: [],
    ignored: [],
    probeFailures: [],
  };
}

function presetWithMinTermLength(minTermLength: number): MontagePreset {
  return {
    ...softwareDemoPreset,
    concepts: { ...softwareDemoPreset.concepts, minTermLength },
  };
}

describe('buildBrollIndex (CA-009 §5.2)', () => {
  it('genera un candidato con role "broll" para un asset de broll/', () => {
    const catalog = catalogOf([
      catalogAsset(
        'broll',
        mediaAsset({ id: 'raw/broll/cocina.mp4', path: 'raw/broll/cocina.mp4', kind: 'video' }),
      ),
    ]);

    const index = buildBrollIndex(catalog, presetWithMinTermLength(4));

    expect(index).toEqual([
      {
        assetId: 'raw/broll/cocina.mp4',
        role: 'broll',
        kind: 'video',
        durationMs: 5000,
        tokens: new Set(['cocina']),
      },
    ]);
  });

  it('genera un candidato con role "image" para un asset de images/', () => {
    const catalog = catalogOf([
      catalogAsset(
        'image',
        mediaAsset({ id: 'raw/images/producto.jpg', path: 'raw/images/producto.jpg', kind: 'image' }),
      ),
    ]);

    const index = buildBrollIndex(catalog, presetWithMinTermLength(4));

    expect(index).toEqual([
      {
        assetId: 'raw/images/producto.jpg',
        role: 'image',
        kind: 'image',
        durationMs: 5000,
        tokens: new Set(['producto']),
      },
    ]);
  });

  it('excluye assets de role aroll y audio', () => {
    const catalog = catalogOf([
      catalogAsset(
        'aroll',
        mediaAsset({ id: 'raw/aroll/camara.mp4', path: 'raw/aroll/camara.mp4', kind: 'video' }),
      ),
      catalogAsset(
        'audio',
        mediaAsset({ id: 'raw/audio/musica.mp3', path: 'raw/audio/musica.mp3', kind: 'audio' }),
      ),
    ]);

    const index = buildBrollIndex(catalog, presetWithMinTermLength(4));

    expect(index).toEqual([]);
  });

  it('descarta un asset sin ningún token útil', () => {
    const catalog = catalogOf([
      catalogAsset(
        'broll',
        mediaAsset({ id: 'raw/broll/01-02.mp4', path: 'raw/broll/01-02.mp4', kind: 'video' }),
      ),
    ]);

    const index = buildBrollIndex(catalog, presetWithMinTermLength(4));

    expect(index).toEqual([]);
  });

  it('devuelve el índice ordenado por assetId ascendente, sin importar el orden del catálogo', () => {
    const zebra = catalogAsset(
      'broll',
      mediaAsset({ id: 'raw/broll/zebra.mp4', path: 'raw/broll/zebra.mp4', kind: 'video' }),
    );
    const alpha = catalogAsset(
      'image',
      mediaAsset({ id: 'raw/images/alpha.jpg', path: 'raw/images/alpha.jpg', kind: 'image' }),
    );
    const expectedOrder = ['raw/broll/zebra.mp4', 'raw/images/alpha.jpg'];

    const inOrder = buildBrollIndex(catalogOf([zebra, alpha]), presetWithMinTermLength(4));
    const reversed = buildBrollIndex(catalogOf([alpha, zebra]), presetWithMinTermLength(4));

    expect(inOrder.map((candidate) => candidate.assetId)).toEqual(expectedOrder);
    expect(reversed.map((candidate) => candidate.assetId)).toEqual(expectedOrder);
  });
});
