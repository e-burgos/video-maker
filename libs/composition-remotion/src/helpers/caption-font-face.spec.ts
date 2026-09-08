import { describe, expect, it } from 'vitest';
import { captionFontFaceCss } from './caption-font-face';
import type { CaptionFontFace } from './caption-font-face';

describe('captionFontFaceCss', () => {
  it('genera un bloque @font-face con fontFamily, url y formato correctos', () => {
    const css = captionFontFaceCss([
      {
        family: 'Inter Tight',
        src: '/fonts/InterTight-Bold.woff2',
        weight: 800,
        style: 'normal',
        format: 'woff2',
        display: 'block',
      },
    ]);

    expect(css).toBe(
      '@font-face{font-family:"Inter Tight";src:url("/fonts/InterTight-Bold.woff2") format("woff2");font-weight:800;font-style:normal;font-display:block}',
    );
  });

  it('devuelve un string vacío para una lista vacía', () => {
    expect(captionFontFaceCss([])).toBe('');
  });

  it('emite un bloque por entrada, unidos por salto de línea, en el orden recibido', () => {
    const faces: CaptionFontFace[] = [
      {
        family: 'Mi Fuente',
        src: '/fonts/MiFuente-Regular.woff2',
        weight: 400,
        style: 'normal',
        format: 'woff2',
        display: 'swap',
      },
      {
        family: 'Mi Fuente',
        src: '/fonts/MiFuente-Bold.woff2',
        weight: 700,
        style: 'normal',
        format: 'woff2',
        display: 'swap',
      },
    ];

    const css = captionFontFaceCss(faces);
    const blocks = css.split('\n');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('MiFuente-Regular.woff2');
    expect(blocks[1]).toContain('MiFuente-Bold.woff2');
  });

  it.each([
    ['italic', 500, 'fallback', 'opentype'],
    ['normal', 'bold', 'optional', 'truetype'],
    ['italic', 900, 'auto', 'woff'],
  ] as const)(
    'declara style=%s, weight=%s, display=%s, format=%s sin aplicar ningún default propio',
    (style, weight, display, format) => {
      const css = captionFontFaceCss([
        {
          family: 'Variante',
          src: '/fonts/variante.woff2',
          weight,
          style,
          format,
          display,
        },
      ]);

      expect(css).toContain(`font-weight:${weight};`);
      expect(css).toContain(`font-style:${style};`);
      expect(css).toContain(`font-display:${display}}`);
      expect(css).toContain(`format("${format}")`);
    },
  );

  it('usa la URL recibida tal cual, sin normalizarla ni anteponer ningún prefijo', () => {
    const rawUrl = 'https://cdn.example.com/assets/fonts/weird.path.v2.woff2?cache=1';

    const css = captionFontFaceCss([
      {
        family: 'Remota',
        src: rawUrl,
        weight: 400,
        style: 'normal',
        format: 'woff2',
        display: 'block',
      },
    ]);

    expect(css).toContain(`src:url("${rawUrl}") format("woff2")`);
  });

  it('escapa comillas dobles y barras invertidas en family y en src', () => {
    const css = captionFontFaceCss([
      {
        family: 'Fuente "Especial"',
        src: '/fonts/weird\\name"with-quotes".woff2',
        weight: 400,
        style: 'normal',
        format: 'woff2',
        display: 'block',
      },
    ]);

    expect(css).toBe(
      '@font-face{font-family:"Fuente \\"Especial\\"";' +
        'src:url("/fonts/weird\\\\name\\"with-quotes\\".woff2") format("woff2");' +
        'font-weight:400;font-style:normal;font-display:block}',
    );
  });
});
