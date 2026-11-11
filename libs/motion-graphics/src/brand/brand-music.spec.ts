import { describe, expect, it } from 'vitest';

import { brandTrackSourcePath, parseLocalMusicList, trackFitsVideoType, withLocalMusic } from './brand-music';

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
});
