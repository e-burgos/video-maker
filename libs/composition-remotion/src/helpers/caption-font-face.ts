export type CaptionFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype';

export type CaptionFontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

export interface CaptionFontFace {
  family: string;
  src: string;
  weight: number | string;
  style: 'normal' | 'italic';
  format: CaptionFontFormat;
  display: CaptionFontDisplay;
}

function escapeFontFaceValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function captionFontFaceBlock(face: CaptionFontFace): string {
  const family = escapeFontFaceValue(face.family);
  const src = escapeFontFaceValue(face.src);

  return (
    `@font-face{font-family:"${family}";` +
    `src:url("${src}") format("${face.format}");` +
    `font-weight:${face.weight};` +
    `font-style:${face.style};` +
    `font-display:${face.display}}`
  );
}

export function captionFontFaceCss(faces: readonly CaptionFontFace[]): string {
  return faces.map(captionFontFaceBlock).join('\n');
}
