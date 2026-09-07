import { describe, expect, it } from 'vitest';

import { arollAsset, brollAsset, musicAsset } from '../__fixtures__/assets';
import { overlappingWords, spanishTranscription } from '../__fixtures__/transcription';
import { MediaAssetSchema } from './media-asset.schema';
import { OutputFormatSchema, SafeZoneSchema } from './output-format.schema';
import { SegmentSchema, TranscriptionSchema, WordSchema } from './transcription.schema';

describe('OutputFormatSchema', () => {
  it('acepta un formato reels-9x16 válido', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza un preset fuera de la unión cerrada', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'square-1x1',
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['preset']);
    }
  });

  it('rechaza un fps fuera de la unión cerrada', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 29,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['fps']);
    }
  });

  it('rechaza width por debajo del mínimo', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 100,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['width']);
    }
  });

  it('rechaza propiedades adicionales', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 30,
      extra: true,
    });

    expect(result.success).toBe(false);
  });
});

describe('SafeZoneSchema', () => {
  it('acepta márgenes enteros', () => {
    const result = SafeZoneSchema.safeParse({ top: 220, bottom: 400, left: 60, right: 140 });

    expect(result.success).toBe(true);
  });

  it('rechaza un margen no entero', () => {
    const result = SafeZoneSchema.safeParse({ top: 220.5, bottom: 400, left: 60, right: 140 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['top']);
    }
  });
});

describe('MediaAssetSchema', () => {
  it('acepta el fixture de video arollAsset', () => {
    expect(MediaAssetSchema.safeParse(arollAsset).success).toBe(true);
  });

  it('acepta el fixture de imagen brollAsset', () => {
    expect(MediaAssetSchema.safeParse(brollAsset).success).toBe(true);
  });

  it('acepta el fixture de audio musicAsset', () => {
    expect(MediaAssetSchema.safeParse(musicAsset).success).toBe(true);
  });

  it('rechaza un asset video sin fps', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-fps',
      kind: 'video',
      path: '/fixtures/video-sin-fps.mp4',
      durationMs: 5_000,
      width: 1080,
      height: 1920,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'fps')).toBe(true);
    }
  });

  it('rechaza un asset video sin width', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-width',
      kind: 'video',
      path: '/fixtures/video-sin-width.mp4',
      durationMs: 5_000,
      fps: 30,
      height: 1920,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'width')).toBe(true);
    }
  });

  it('rechaza un asset video sin height', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-height',
      kind: 'video',
      path: '/fixtures/video-sin-height.mp4',
      durationMs: 5_000,
      fps: 30,
      width: 1080,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'height')).toBe(true);
    }
  });

  it('rechaza un asset video sin hasAudio', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-has-audio',
      kind: 'video',
      path: '/fixtures/video-sin-has-audio.mp4',
      durationMs: 5_000,
      fps: 30,
      width: 1080,
      height: 1920,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'hasAudio')).toBe(true);
    }
  });

  it('rechaza un asset image con durationMs distinto de cero', () => {
    const result = MediaAssetSchema.safeParse({ ...brollAsset, durationMs: 500 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['durationMs']);
    }
  });

  it('rechaza un asset image con fps declarado', () => {
    const result = MediaAssetSchema.safeParse({ ...brollAsset, fps: 30 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['fps']);
    }
  });

  it('rechaza propiedades adicionales', () => {
    const result = MediaAssetSchema.safeParse({ ...arollAsset, extra: true });

    expect(result.success).toBe(false);
  });
});

describe('WordSchema y SegmentSchema', () => {
  it('rechaza una palabra vacía', () => {
    const result = WordSchema.safeParse({ text: '', startMs: 0, endMs: 100 });

    expect(result.success).toBe(false);
  });

  it('acepta un segmento sin additionalProperties: false', () => {
    const result = SegmentSchema.safeParse({
      startMs: 0,
      endMs: 100,
      text: 'hola',
      wordRange: [0, 1],
      note: 'campo no declarado en el contrato pero permitido',
    });

    expect(result.success).toBe(true);
  });
});

describe('TranscriptionSchema', () => {
  it('acepta el fixture spanishTranscription completo', () => {
    const result = TranscriptionSchema.safeParse(spanishTranscription);

    expect(result.success).toBe(true);
  });

  it('rechaza propiedades adicionales en el documento', () => {
    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, extra: true });

    expect(result.success).toBe(false);
  });

  it('rechaza una palabra con endMs menor que startMs (T1)', () => {
    const words = spanishTranscription.words.map((word, index) =>
      index === 0 ? { ...word, startMs: 300, endMs: 100 } : word,
    );

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, words });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.0.endMs')).toBe(true);
    }
  });

  it('rechaza palabras que no están ordenadas por startMs (T2)', () => {
    const words = [
      { text: 'a', startMs: 100, endMs: 100 },
      { text: 'b', startMs: 50, endMs: 80 },
    ];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, words });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.1.startMs')).toBe(true);
    }
  });

  it('rechaza palabras solapadas (T3)', () => {
    const result = TranscriptionSchema.safeParse({
      ...spanishTranscription,
      words: overlappingWords,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.0.endMs')).toBe(true);
    }
  });

  it('rechaza un wordRange fuera de los límites de words (T4)', () => {
    const segments = [{ ...spanishTranscription.segments[0], wordRange: [0, 25] as [number, number] }];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, segments });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'segments.0.wordRange')).toBe(true);
    }
  });

  it('rechaza un wordRange con el extremo inicial mayor que el final (T4)', () => {
    const segments = [{ ...spanishTranscription.segments[0], wordRange: [5, 3] as [number, number] }];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, segments });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'segments.0.wordRange')).toBe(true);
    }
  });
});
