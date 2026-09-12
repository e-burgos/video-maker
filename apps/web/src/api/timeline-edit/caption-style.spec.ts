import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  CAPTION_STYLE_OPTIONS,
  DEFAULT_CAPTION_STYLE,
  captionStyleLabelKey,
  setTimelineCaptionStyle,
} from './caption-style';

describe('CAPTION_STYLE_OPTIONS', () => {
  it('ofrece los cinco estilos del contrato de la Timeline', () => {
    expect([...CAPTION_STYLE_OPTIONS]).toEqual([
      'bold-impact',
      'clean-sans',
      'outline-pop',
      'subtle-lower',
      'off',
    ]);
  });

  it('tiene una etiqueta traducida por estilo, sin repetir ninguna', () => {
    const keys = CAPTION_STYLE_OPTIONS.map(captionStyleLabelKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('captionStyle.subtleLower');
  });

  it('el estilo implícito de un documento sin captionStyle es bold-impact', () => {
    expect(DEFAULT_CAPTION_STYLE).toBe('bold-impact');
  });
});

describe('setTimelineCaptionStyle', () => {
  it('escribe el estilo en la raíz del documento sin tocar las pistas', () => {
    const timeline = editableTimelineFixture();
    const next = setTimelineCaptionStyle(timeline, 'subtle-lower');

    expect(next.captionStyle).toBe('subtle-lower');
    expect(next.tracks).toBe(timeline.tracks);
  });

  it('reemplaza un estilo anterior', () => {
    const next = setTimelineCaptionStyle(
      setTimelineCaptionStyle(editableTimelineFixture(), 'off'),
      'clean-sans',
    );

    expect(next.captionStyle).toBe('clean-sans');
  });
});
