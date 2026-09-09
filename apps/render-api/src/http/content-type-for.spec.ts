import { describe, expect, it } from 'vitest';

import { contentTypeFor } from './content-type-for';

const CASES: readonly { readonly fileName: string; readonly contentType: string }[] = [
  { fileName: 'clip.mp4', contentType: 'video/mp4' },
  { fileName: 'clip.mov', contentType: 'video/quicktime' },
  { fileName: 'clip.mkv', contentType: 'video/x-matroska' },
  { fileName: 'clip.avi', contentType: 'video/x-msvideo' },
  { fileName: 'clip.webm', contentType: 'video/webm' },
  { fileName: 'photo.jpg', contentType: 'image/jpeg' },
  { fileName: 'photo.jpeg', contentType: 'image/jpeg' },
  { fileName: 'photo.png', contentType: 'image/png' },
  { fileName: 'photo.webp', contentType: 'image/webp' },
  { fileName: 'voice.wav', contentType: 'audio/wav' },
  { fileName: 'voice.mp3', contentType: 'audio/mpeg' },
  { fileName: 'voice.m4a', contentType: 'audio/mp4' },
  { fileName: 'voice.aac', contentType: 'audio/aac' },
  { fileName: 'voice.flac', contentType: 'audio/flac' },
  { fileName: 'catalog.json', contentType: 'application/json; charset=utf-8' },
  { fileName: 'notes.txt', contentType: 'text/plain; charset=utf-8' },
  { fileName: 'captions.srt', contentType: 'application/x-subrip' },
  { fileName: 'captions.vtt', contentType: 'text/vtt' },
  { fileName: 'archive.zip', contentType: 'application/octet-stream' },
  { fileName: 'no-extension', contentType: 'application/octet-stream' },
];

describe('contentTypeFor', () => {
  it.each(CASES)('maps $fileName to $contentType', ({ fileName, contentType }) => {
    expect(contentTypeFor(fileName)).toBe(contentType);
  });
});
