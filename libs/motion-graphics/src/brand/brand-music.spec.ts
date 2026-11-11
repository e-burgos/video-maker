import { describe, expect, it } from 'vitest';

import {
  brandTrackSourcePath,
  collectBrandMusic,
  isLocalMusicTrackFile,
  parseInheritedMusicFile,
  parseLocalMusicList,
  resolveBrandTrackSource,
  trackFitsVideoType,
  withLocalMusic,
} from './brand-music';
import type { BrandMusicReaders, BrandMusicSource, BrandTrack } from './brand-music';

const shipped = { id: 'tema', file: 'music/tema.mp3', credit: 'Tema · CC BY 4.0', bpm: 120, mood: 'energetic' };
const local = { id: 'pulsar', file: 'Pulsar.mp3', credit: 'Pulsar · YouTube', bpm: 104, mood: 'calm ambient', videoTypes: ['tutorial' as const] };

describe('brand music', () => {
  it('adds the local tracks after the shipped ones, marked as local, and never shadows a shipped id', () => {
    const merged = withLocalMusic({ music: [shipped] }, [local, { ...local, id: 'tema', file: 'Otro.mp3' }]);
    expect(merged.music.map((track) => [track.id, track.file])).toEqual([
      ['tema', 'music/tema.mp3'],
      ['pulsar', 'local-music/Pulsar.mp3'],
    ]);
  });

  it('resolves a shipped track inside the brand and a local one inside the local music folder', () => {
    expect(brandTrackSourcePath('/assets/brands/acme', '/user/brands', 'acme', 'music/tema.mp3')).toBe('/assets/brands/acme/music/tema.mp3');
    expect(brandTrackSourcePath('/assets/brands/acme', '/user/brands', 'acme', 'local-music/Pulsar.mp3')).toBe('/user/brands/.local-music/acme/Pulsar.mp3');
    expect(() => brandTrackSourcePath('/assets/brands/acme', undefined, 'acme', 'local-music/Pulsar.mp3')).toThrow('needs a user brands folder');
  });

  it('rejects an unknown video type in the local list', () => {
    expect(() => parseLocalMusicList([{ ...local, videoTypes: ['podcast'] }])).toThrow('music.json is invalid');
  });

  it('treats an untagged track as fit for any kind of video', () => {
    expect(trackFitsVideoType(shipped, 'vertical')).toBe(true);
    expect(trackFitsVideoType(local, 'vertical')).toBe(false);
    expect(trackFitsVideoType(local, 'tutorial')).toBe(true);
  });

  describe('inherited from another brand', () => {
    const own = { id: 'propio', file: 'music/propio.mp3', credit: 'Propio · CC BY 4.0', bpm: 100, mood: 'calm' };
    const sources: Readonly<Record<string, BrandMusicSource>> = {
      madre: { music: [shipped] },
      hija: { music: [own, { ...shipped, file: 'music/tema-propio.mp3' }], musicFrom: 'madre' },
      nieta: { music: [], musicFrom: 'hija' },
      loop: { music: [], musicFrom: 'loop' },
    };
    const locals: Readonly<Record<string, readonly BrandTrack[]>> = { madre: [local] };
    const readers: BrandMusicReaders = {
      readBrandMusicSource: async (brandId) => sources[brandId] ?? { music: [] },
      readLocalTracks: async (brandId) => locals[brandId] ?? [],
    };
    const brandDirs: Readonly<Record<string, string>> = { madre: '/assets/brands/madre', hija: '/user/brands/hija', nieta: '/user/brands/nieta' };
    const locateBrandDir = async (brandId: string): Promise<string> => brandDirs[brandId] ?? '/missing';

    it('adds the parent bank after its own tracks, keeping its own copy when ids clash', async () => {
      const music = await collectBrandMusic(readers, 'hija', sources['hija'] as BrandMusicSource);
      expect(music.map((track) => [track.id, track.file])).toEqual([
        ['propio', 'music/propio.mp3'],
        ['tema', 'music/tema-propio.mp3'],
        ['pulsar', 'brand-music/madre/local-music/Pulsar.mp3'],
      ]);
    });

    it('follows a chain of brands and resolves every file inside the brand that owns it', async () => {
      const music = await collectBrandMusic(readers, 'nieta', sources['nieta'] as BrandMusicSource);
      const pulsar = music.find((track) => track.id === 'pulsar');
      expect(pulsar?.file).toBe('brand-music/hija/brand-music/madre/local-music/Pulsar.mp3');
      expect(isLocalMusicTrackFile(pulsar?.file ?? '')).toBe(true);
      expect(await resolveBrandTrackSource(locateBrandDir, '/user/brands', 'nieta', pulsar?.file ?? '')).toBe('/user/brands/.local-music/madre/Pulsar.mp3');
      expect(await resolveBrandTrackSource(locateBrandDir, '/user/brands', 'nieta', 'brand-music/hija/music/propio.mp3')).toBe('/user/brands/hija/music/propio.mp3');
    });

    it('rejects a brand whose music loops back to itself', async () => {
      await expect(collectBrandMusic(readers, 'loop', sources['loop'] as BrandMusicSource)).rejects.toThrow('loops back');
    });

    it('reads only well formed inherited paths', () => {
      expect(parseInheritedMusicFile('brand-music/madre/music/tema.mp3')).toEqual({ brandId: 'madre', file: 'music/tema.mp3' });
      expect(parseInheritedMusicFile('brand-music/madre/')).toBeNull();
      expect(parseInheritedMusicFile('music/tema.mp3')).toBeNull();
      expect(isLocalMusicTrackFile('brand-music/madre/music/tema.mp3')).toBe(false);
    });
  });
});
