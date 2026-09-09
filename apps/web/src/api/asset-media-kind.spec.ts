import { describe, expect, it } from 'vitest';

import {
  assetContentType,
  assetMediaKind,
  fileExtension,
  formatBytes,
  formatDuration,
} from './asset-media-kind';

describe('assetMediaKind', () => {
  it('classifies the extensions the service can serve', () => {
    expect(assetMediaKind('clip01.mp4')).toBe('video');
    expect(assetMediaKind('clip01.MOV')).toBe('video');
    expect(assetMediaKind('photo01.jpg')).toBe('image');
    expect(assetMediaKind('music01.mp3')).toBe('audio');
    expect(assetMediaKind('take.flac')).toBe('audio');
  });

  it('falls back to other for an unknown or missing extension', () => {
    expect(assetMediaKind('notes.txt')).toBe('other');
    expect(assetMediaKind('README')).toBe('other');
  });

  it('mirrors the content types the service derives from the same table', () => {
    expect(assetContentType('clip01.mp4')).toBe('video/mp4');
    expect(assetContentType('photo01.jpeg')).toBe('image/jpeg');
    expect(assetContentType('music01.mp3')).toBe('audio/mpeg');
    expect(assetContentType('notes.txt')).toBe('application/octet-stream');
    expect(assetContentType('README')).toBe('application/octet-stream');
  });

  it('reads the extension case-insensitively', () => {
    expect(fileExtension('CLIP.MP4')).toBe('.mp4');
    expect(fileExtension('noext')).toBe('');
  });

  it('formats sizes across the three magnitudes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(5621)).toBe('5.5 kB');
    expect(formatBytes(2029043)).toBe('1.9 MB');
  });

  it('formats a duration as minutes and padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(22500)).toBe('0:23');
    expect(formatDuration(125000)).toBe('2:05');
  });
});
