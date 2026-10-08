import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  CAPTION_STYLE_OPTIONS,
  DEFAULT_CAPTION_STYLE,
  captionStyleLabelKey,
  captionStyleOptions,
  setTimelineCaptionStyle,
} from './caption-style';

describe('CAPTION_STYLE_OPTIONS', () => {
  it('ofrece los seis estilos del contrato de la Timeline', () => {
    expect([...CAPTION_STYLE_OPTIONS]).toEqual([
      'bold-impact',
      'clean-sans',
      'outline-pop',
      'subtle-lower',
      'brand',
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

const THEME = {
  fontFamily: 'Outfit',
  fontFiles: [{ path: 'work/brand/fonts/outfit.woff2' }],
  textColor: '#ffffff',
  accentColor: '#0ea5e9',
  boxColor: '#09090b',
};

describe('estilo de la marca', () => {
  it('captionStyleOptions ofrece brand sólo cuando hay tema disponible', () => {
    expect(captionStyleOptions(false)).not.toContain('brand');
    expect(captionStyleOptions(true)).toContain('brand');
  });

  it('elegir brand con tema escribe estilo y tema en el documento', () => {
    const next = setTimelineCaptionStyle(editableTimelineFixture(), 'brand', THEME);

    expect(next.captionStyle).toBe('brand');
    expect(next.captionTheme).toEqual(THEME);
  });

  it('otro estilo no toca el tema que ya tenía el documento', () => {
    const withTheme = setTimelineCaptionStyle(editableTimelineFixture(), 'brand', THEME);

    expect(setTimelineCaptionStyle(withTheme, 'off').captionTheme).toEqual(THEME);
  });
});
