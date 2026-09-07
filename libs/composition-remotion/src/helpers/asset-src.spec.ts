import type { MediaAsset } from '@video-maker/timeline-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('remotion', () => ({
  staticFile: vi.fn((path: string) => `/static-mock/${path}`),
}));

import { staticFile } from 'remotion';
import { assetSrc } from './asset-src';

function buildAsset(path: string): MediaAsset {
  return {
    id: 'asset-under-test',
    kind: 'image',
    path,
    durationMs: 0,
    width: 1080,
    height: 1920,
    probedAt: '2026-09-07T00:00:00.000Z',
  };
}

describe('assetSrc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resuelve una ruta relativa con staticFile()', () => {
    const asset = buildAsset('example/broll.jpg');

    expect(assetSrc(asset)).toBe('/static-mock/example/broll.jpg');
    expect(staticFile).toHaveBeenCalledWith('example/broll.jpg');
  });

  it('devuelve tal cual una URL http', () => {
    const asset = buildAsset('http://cdn.example.com/broll.jpg');

    expect(assetSrc(asset)).toBe('http://cdn.example.com/broll.jpg');
    expect(staticFile).not.toHaveBeenCalled();
  });

  it('devuelve tal cual una URL https', () => {
    const asset = buildAsset('https://cdn.example.com/broll.jpg');

    expect(assetSrc(asset)).toBe('https://cdn.example.com/broll.jpg');
    expect(staticFile).not.toHaveBeenCalled();
  });

  it('devuelve tal cual una URL file://', () => {
    const asset = buildAsset('file:///Users/dev/broll.jpg');

    expect(assetSrc(asset)).toBe('file:///Users/dev/broll.jpg');
    expect(staticFile).not.toHaveBeenCalled();
  });

  it('convierte una ruta absoluta unix a file:// con cada segmento codificado', () => {
    const asset = buildAsset('/Users/dev/video clips/aroll.mp4');

    expect(assetSrc(asset)).toBe('file:///Users/dev/video%20clips/aroll.mp4');
    expect(staticFile).not.toHaveBeenCalled();
  });

  it('convierte una ruta absoluta de Windows preservando la letra de unidad', () => {
    const asset = buildAsset('C:\\Users\\dev\\aroll.mp4');

    expect(assetSrc(asset)).toBe('file:///C:/Users/dev/aroll.mp4');
    expect(staticFile).not.toHaveBeenCalled();
  });
});
