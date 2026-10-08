import { describe, expect, it } from 'vitest';

import { brandFileUrl, fileStemSlug, percentPoint, safeUploadName, uniqueKey } from './brand-files';

describe('brand files', () => {
  it('builds the files endpoint url encoding each segment', () => {
    expect(brandFileUrl('mine', 'music/Voxel Revolution.mp3')).toBe(
      '/api/brands/mine/files/music/Voxel%20Revolution.mp3',
    );
  });

  it('derives a slug key from the file stem', () => {
    expect(fileStemSlug('Café Fachada (1).JPG')).toBe('cafe-fachada-1');
    expect(fileStemSlug('.png')).toBe('item');
  });

  it('makes the upload name safe for the files endpoint', () => {
    expect(safeUploadName('Mi Logo Nuevo.PNG')).toBe('mi-logo-nuevo.png');
  });

  it('suffixes a key that is already taken', () => {
    expect(uniqueKey('foto', ['foto', 'foto-2'])).toBe('foto-3');
    expect(uniqueKey('otra', ['foto'])).toBe('otra');
  });

  it('converts a click into percentages of the image, clamped and rounded', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };

    expect(percentPoint(110, 70, rect)).toEqual([50, 50]);
    expect(percentPoint(0, 500, rect)).toEqual([0, 100]);
    expect(percentPoint(43.3, 33.3, rect)).toEqual([16.65, 13.3]);
  });
});
