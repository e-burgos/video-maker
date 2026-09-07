import { describe, expect, it } from 'vitest';

import { isSupportedExtension, mediaKindForExtension } from './supported-extensions';

describe('isSupportedExtension', () => {
  it.each([
    'clip01.mp4',
    'clip01.MOV',
    'photo.jpg',
    'photo.jpeg',
    'photo.PNG',
    'voice.wav',
    'music.mp3',
    'music.m4a',
  ])('acepta "%s"', (fileName) => {
    expect(isSupportedExtension(fileName)).toBe(true);
  });

  it('rechaza una extensión desconocida', () => {
    expect(isSupportedExtension('notes.txt')).toBe(false);
  });

  it('rechaza un archivo sin extensión', () => {
    expect(isSupportedExtension('README')).toBe(false);
  });
});

describe('mediaKindForExtension', () => {
  it('mapea extensiones de video a "video"', () => {
    expect(mediaKindForExtension('clip01.mp4')).toBe('video');
    expect(mediaKindForExtension('clip01.MOV')).toBe('video');
  });

  it('mapea extensiones de imagen a "image"', () => {
    expect(mediaKindForExtension('photo.jpg')).toBe('image');
  });

  it('mapea extensiones de audio a "audio"', () => {
    expect(mediaKindForExtension('voice.wav')).toBe('audio');
  });

  it('devuelve undefined para una extensión no soportada', () => {
    expect(mediaKindForExtension('notes.txt')).toBeUndefined();
  });

  it('devuelve undefined para un archivo sin extensión', () => {
    expect(mediaKindForExtension('README')).toBeUndefined();
  });
});
