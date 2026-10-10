import { describe, expect, it } from 'vitest';
import { defaultFormat } from '@video-maker/timeline-core';
import { CAPTION_PRESET_IDS, captionPreset } from './caption-preset';
import { captionSafeZone } from './caption-safe-zone';
import { captionBoxFor } from './caption-box';
import { fitCaptionFontSize } from './caption-font-size';
import type { CaptionWord } from './timeline-types';

function word(text: string): CaptionWord {
  return { text, fromFrame: 0, durationFrames: 1 };
}

const TIKTOK_FORMAT = defaultFormat('tiktok-9x16');
const TIKTOK_BOX = { x: 60, y: 610, width: 700, height: 461 };
const BOLD_IMPACT = captionPreset('bold-impact');

describe('fitCaptionFontSize — CA-005', () => {
  it('una frase de tres palabras largas da un tamaño ESTRICTAMENTE menor que una palabra corta', () => {
    const shortResult = fitCaptionFontSize(
      [word('GO')],
      TIKTOK_BOX,
      BOLD_IMPACT,
      TIKTOK_FORMAT,
    );
    const longResult = fitCaptionFontSize(
      [word('EXTRAORDINARIO'), word('RENDIMIENTO'), word('SOSTENIDO')],
      TIKTOK_BOX,
      BOLD_IMPACT,
      TIKTOK_FORMAT,
    );

    expect(shortResult).toBe(211);
    expect(longResult).toBe(86);
    expect(longResult).toBeLessThan(shortResult);
  });

  it('con emphasisIndex reserva el escalado de la palabra enfatizada y de la activa: tamaño estrictamente menor (FIX-e-burgos-003-001)', () => {
    const words = [word('HOY'), word('MISMO')];
    const preset = captionPreset('bold-impact');
    const legacy = fitCaptionFontSize(words, TIKTOK_BOX, preset, TIKTOK_FORMAT);
    const withEmphasis = fitCaptionFontSize(words, TIKTOK_BOX, preset, TIKTOK_FORMAT, 1);
    const withoutEmphasisWord = fitCaptionFontSize(words, TIKTOK_BOX, preset, TIKTOK_FORMAT, null);

    expect(withEmphasis).toBeLessThan(legacy);
    expect(withoutEmphasisWord).toBeLessThan(legacy);
    expect(withEmphasis).toBeLessThan(withoutEmphasisWord);
  });

  it('nunca sale de [minFontSize, maxFontSize]: satura en el techo con una caja gigante', () => {
    const giantBox = { x: 0, y: 0, width: 100000, height: 100000 };

    const result = fitCaptionFontSize([word('GO')], giantBox, BOLD_IMPACT, TIKTOK_FORMAT);

    expect(result).toBe(Math.round(TIKTOK_FORMAT.height * BOLD_IMPACT.maxFontSizeRatio));
  });

  it('nunca sale de [minFontSize, maxFontSize]: satura en el piso con una caja diminuta', () => {
    const tinyBox = { x: 0, y: 0, width: 1, height: 1 };

    const result = fitCaptionFontSize(
      [word('EXTRAORDINARIO'), word('RENDIMIENTO'), word('SOSTENIDO')],
      tinyBox,
      BOLD_IMPACT,
      TIKTOK_FORMAT,
    );

    expect(result).toBe(Math.round(TIKTOK_FORMAT.height * BOLD_IMPACT.minFontSizeRatio));
  });

  it('frente a la misma entrada, dos llamadas devuelven exactamente el mismo valor (RN-12)', () => {
    const words = [word('HOY'), word('MISMO')];

    const first = fitCaptionFontSize(words, TIKTOK_BOX, BOLD_IMPACT, TIKTOK_FORMAT);
    const second = fitCaptionFontSize(words, TIKTOK_BOX, BOLD_IMPACT, TIKTOK_FORMAT);

    expect(first).toBe(second);
    expect(first).toBe(118);
  });

  it('el caso intermedio (dos palabras medianas) no satura en ningún extremo del clamp', () => {
    const result = fitCaptionFontSize(
      [word('HOY'), word('MISMO')],
      TIKTOK_BOX,
      BOLD_IMPACT,
      TIKTOK_FORMAT,
    );

    expect(result).toBeGreaterThan(86);
    expect(result).toBeLessThan(211);
  });

  it('una lista vacía de palabras cae a la guarda del paso 5 y devuelve el techo (CE-4)', () => {
    const result = fitCaptionFontSize([], TIKTOK_BOX, BOLD_IMPACT, TIKTOK_FORMAT);

    expect(result).toBe(211);
  });

  it('el tope por alto de caja (heightCap) liga cuando la caja se achica en altura', () => {
    const shortBox = { x: 60, y: 610, width: 700, height: 100 };

    const result = fitCaptionFontSize([word('GO')], shortBox, BOLD_IMPACT, TIKTOK_FORMAT);

    expect(result).toBe(90);
  });
});

describe('fitCaptionFontSize — textTransform no agrega un multiplicador aparte (D-07)', () => {
  it('el resultado depende solo de averageCharWidthEm, no del valor de textTransform', () => {
    const uppercasePreset = { ...BOLD_IMPACT, textTransform: 'uppercase' as const };
    const noneTransformSamePreset = { ...BOLD_IMPACT, textTransform: 'none' as const };

    const withUppercase = fitCaptionFontSize(
      [word('HOY'), word('MISMO')],
      TIKTOK_BOX,
      uppercasePreset,
      TIKTOK_FORMAT,
    );
    const withoutTransform = fitCaptionFontSize(
      [word('HOY'), word('MISMO')],
      TIKTOK_BOX,
      noneTransformSamePreset,
      TIKTOK_FORMAT,
    );

    expect(withUppercase).toBe(withoutTransform);
  });
});

describe('fitCaptionFontSize — conteo de caracteres por punto de código (R-1)', () => {
  it('un emoji cuenta como un único carácter, igual que una letra simple', () => {
    const withEmoji = fitCaptionFontSize([word('🔥🔥')], TIKTOK_BOX, BOLD_IMPACT, TIKTOK_FORMAT);
    const withPlainChars = fitCaptionFontSize([word('AB')], TIKTOK_BOX, BOLD_IMPACT, TIKTOK_FORMAT);

    expect(withEmoji).toBe(withPlainChars);
  });
});

describe.each(CAPTION_PRESET_IDS)('fitCaptionFontSize — %s', (id) => {
  it('devuelve un tamaño dentro de [minFontSize, maxFontSize] del preset', () => {
    const preset = captionPreset(id);
    const format = defaultFormat('reels-9x16');
    const safeZone = captionSafeZone(format, 'instagram-reels');
    const box = captionBoxFor(safeZone, format, preset);

    const result = fitCaptionFontSize(
      [word('Un'), word('subtítulo'), word('cualquiera')],
      box,
      preset,
      format,
    );

    const minFontSize = Math.round(format.height * preset.minFontSizeRatio);
    const maxFontSize = Math.round(format.height * preset.maxFontSizeRatio);

    expect(result).toBeGreaterThanOrEqual(minFontSize);
    expect(result).toBeLessThanOrEqual(maxFontSize);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('fitCaptionFontSize — maxLines (FIX-003-004)', () => {
  const SENTENCE = 'Cada anuncio arranca de una plantilla y el editor la ajusta en dos minutos'
    .split(' ')
    .map(word);

  it('un preset de dos líneas admite un tamaño mayor que el mismo preset de una', () => {
    const oneLine = captionPreset('subtle-lower');
    const twoLines = { ...oneLine, maxLines: 2, boxHeightRatio: 0.15 };
    const format = defaultFormat('youtube-16x9');
    const safeZone = captionSafeZone(format);
    const box = captionBoxFor(safeZone, format, twoLines);

    expect(fitCaptionFontSize(SENTENCE, box, twoLines, format)).toBeGreaterThan(
      fitCaptionFontSize(SENTENCE, box, oneLine, format),
    );
  });

  it('el alto de las dos líneas entra en la caja del preset', () => {
    const preset = captionPreset('subtle-lower');
    const format = defaultFormat('youtube-16x9');
    const safeZone = captionSafeZone(format);
    const box = captionBoxFor(safeZone, format, preset);
    const fontSize = fitCaptionFontSize(SENTENCE, box, preset, format);

    expect(fontSize * preset.lineHeightEm * preset.maxLines).toBeLessThanOrEqual(box.height);
  });

  it('con backdrop, el alto de las dos líneas más su padding vertical entra en la caja', () => {
    const preset = captionPreset('subtle-lower');
    const format = defaultFormat('youtube-16x9');
    const safeZone = captionSafeZone(format);
    const box = captionBoxFor(safeZone, format, preset);
    const fontSize = fitCaptionFontSize(SENTENCE, box, preset, format);
    const paddingYEm = preset.backdrop?.paddingYEm ?? 0;

    expect(fontSize * (preset.lineHeightEm * preset.maxLines + 2 * paddingYEm)).toBeLessThanOrEqual(box.height);
  });

  it('el backdrop reserva ancho: un preset con caja nunca da un tamaño mayor que el mismo sin caja', () => {
    const withBackdrop = captionPreset('subtle-lower');
    const withoutBackdrop = { ...withBackdrop, backdrop: null };
    const format = defaultFormat('reels-9x16');
    const box = captionBoxFor(captionSafeZone(format), format, withBackdrop);

    expect(fitCaptionFontSize(SENTENCE, box, withBackdrop, format)).toBeLessThanOrEqual(
      fitCaptionFontSize(SENTENCE, box, withoutBackdrop, format),
    );
  });

  it('maxLines 1 deja la fórmula anterior intacta para los cinéticos', () => {
    const preset = captionPreset('bold-impact');

    expect(fitCaptionFontSize([word('GO')], TIKTOK_BOX, preset, TIKTOK_FORMAT)).toBe(211);
  });
});
