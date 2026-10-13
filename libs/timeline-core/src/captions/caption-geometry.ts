import type { SafeZone } from '../schemas/output-format.schema';

export type CaptionAnchor = 'top' | 'center' | 'bottom';

export type CaptionGeometryId = 'bold-impact' | 'clean-sans' | 'outline-pop' | 'subtle-lower' | 'brand';

export interface CaptionBackdropPadding {
  readonly paddingXEm: number;
  readonly paddingYEm: number;
}

export interface CaptionGeometry {
  readonly anchor: CaptionAnchor;
  readonly maxLines: number;
  readonly boxHeightRatio: number;
  readonly sidePaddingRatio: number;
  readonly minFontSizeRatio: number;
  readonly maxFontSizeRatio: number;
  readonly lineHeightEm: number;
  readonly wordGapEm: number;
  readonly averageCharWidthEm: number;
  readonly letterSpacingEm: number;
  readonly emphasisScale: number;
  readonly activeScale: number;
  readonly backdrop: CaptionBackdropPadding | null;
}

export interface CaptionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CaptionFrame {
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_CAPTION_GEOMETRY_ID: CaptionGeometryId = 'bold-impact';
export const PORTRAIT_MAX_SIDE_PADDING_RATIO = 0.06;
export const PIP_WIDTH_RATIO = 0.32;
export const PIP_MARGIN_RATIO = 0.05;

export const CAPTION_GEOMETRY: Readonly<Record<CaptionGeometryId, CaptionGeometry>> = {
  'bold-impact': { anchor: 'center', maxLines: 1, boxHeightRatio: 0.24, sidePaddingRatio: 0.04, minFontSizeRatio: 0.045, maxFontSizeRatio: 0.11, lineHeightEm: 1.1, wordGapEm: 0.3, averageCharWidthEm: 0.62, letterSpacingEm: 0.02, emphasisScale: 1.12, activeScale: 1.08, backdrop: null },
  'clean-sans': { anchor: 'bottom', maxLines: 1, boxHeightRatio: 0.18, sidePaddingRatio: 0.05, minFontSizeRatio: 0.035, maxFontSizeRatio: 0.075, lineHeightEm: 1.15, wordGapEm: 0.28, averageCharWidthEm: 0.52, letterSpacingEm: 0, emphasisScale: 1.08, activeScale: 1.06, backdrop: null },
  'outline-pop': { anchor: 'center', maxLines: 1, boxHeightRatio: 0.22, sidePaddingRatio: 0.04, minFontSizeRatio: 0.04, maxFontSizeRatio: 0.1, lineHeightEm: 1.1, wordGapEm: 0.32, averageCharWidthEm: 0.6, letterSpacingEm: 0.01, emphasisScale: 1.14, activeScale: 1.1, backdrop: null },
  'subtle-lower': { anchor: 'bottom', maxLines: 1, boxHeightRatio: 0.08, sidePaddingRatio: 0.2, minFontSizeRatio: 0.03, maxFontSizeRatio: 0.038, lineHeightEm: 1.28, wordGapEm: 0.26, averageCharWidthEm: 0.52, letterSpacingEm: 0.005, emphasisScale: 1, activeScale: 1, backdrop: { paddingXEm: 0.6, paddingYEm: 0.35 } },
  brand: { anchor: 'bottom', maxLines: 1, boxHeightRatio: 0.18, sidePaddingRatio: 0.05, minFontSizeRatio: 0.035, maxFontSizeRatio: 0.07, lineHeightEm: 1.2, wordGapEm: 0.28, averageCharWidthEm: 0.54, letterSpacingEm: 0, emphasisScale: 1.08, activeScale: 1.05, backdrop: null },
};

export function captionGeometryForFrame<T extends CaptionGeometry>(geometry: T, frame: CaptionFrame): T {
  if (frame.height <= frame.width || geometry.sidePaddingRatio <= PORTRAIT_MAX_SIDE_PADDING_RATIO) {
    return geometry;
  }
  const shortSideScale = frame.width / frame.height;
  return {
    ...geometry,
    sidePaddingRatio: PORTRAIT_MAX_SIDE_PADDING_RATIO,
    minFontSizeRatio: geometry.minFontSizeRatio * shortSideScale,
    maxFontSizeRatio: geometry.maxFontSizeRatio * shortSideScale,
    boxHeightRatio: geometry.boxHeightRatio * shortSideScale,
  };
}

function anchoredOffsetY(anchor: CaptionAnchor, slack: number): number {
  if (anchor === 'top') {
    return 0;
  }
  return anchor === 'center' ? Math.round(slack / 2) : slack;
}

export function captionBoxRect(
  safeZone: SafeZone,
  format: CaptionFrame,
  geometry: Pick<CaptionGeometry, 'boxHeightRatio' | 'anchor'>,
  anchor?: CaptionAnchor,
): CaptionRect {
  const availableWidth = Math.max(0, format.width - safeZone.left - safeZone.right);
  const availableHeight = Math.max(0, format.height - safeZone.top - safeZone.bottom);
  const height = Math.min(Math.round(format.height * geometry.boxHeightRatio), availableHeight);
  const slack = availableHeight - height;
  return {
    x: safeZone.left,
    y: safeZone.top + anchoredOffsetY(anchor ?? geometry.anchor, slack),
    width: availableWidth,
    height,
  };
}

export function captionTextWidthEm(
  words: readonly string[],
  geometry: CaptionGeometry,
  emphasisIndex?: number | null,
): number {
  const wordWidthsEm = words.map((word, index) => {
    const baseWidthEm = [...word].length * (geometry.averageCharWidthEm + geometry.letterSpacingEm);
    return index === emphasisIndex ? baseWidthEm * geometry.emphasisScale : baseWidthEm;
  });
  const activeReserveEm =
    emphasisIndex === undefined ? 0 : Math.max(0, ...wordWidthsEm) * (geometry.activeScale - 1);
  const backdropWidthEm = geometry.backdrop === null ? 0 : 2 * geometry.backdrop.paddingXEm * geometry.maxLines;
  return (
    backdropWidthEm +
    wordWidthsEm.reduce((total, widthEm) => total + widthEm, 0) +
    Math.max(0, words.length - 1) * geometry.wordGapEm +
    activeReserveEm
  );
}

export function fitCaptionFontSizeFor(
  words: readonly string[],
  box: CaptionRect,
  geometry: CaptionGeometry,
  format: CaptionFrame,
  emphasisIndex?: number | null,
): number {
  const minFontSize = Math.round(format.height * geometry.minFontSizeRatio);
  const maxFontSize = Math.round(format.height * geometry.maxFontSizeRatio);
  const widthEm = captionTextWidthEm(words, geometry, emphasisIndex);
  if (widthEm <= 0) {
    return maxFontSize;
  }
  const lines = Math.max(1, geometry.maxLines);
  const backdropHeightEm = geometry.backdrop === null ? 0 : 2 * geometry.backdrop.paddingYEm;
  const availableWidth = Math.max(0, box.width * (1 - 2 * geometry.sidePaddingRatio)) * lines;
  const heightCap = Math.floor(box.height / (geometry.lineHeightEm * lines + backdropHeightEm));
  const rawFontSize = Math.min(availableWidth / widthEm, heightCap);
  return Math.min(maxFontSize, Math.max(minFontSize, Math.floor(rawFontSize)));
}

export function captionTextRect(
  words: readonly string[],
  emphasisIndex: number | null,
  captionStyle: string | null,
  format: CaptionFrame,
  safeZone: SafeZone,
): CaptionRect {
  const known = captionStyle !== null && captionStyle in CAPTION_GEOMETRY;
  const base = CAPTION_GEOMETRY[known ? (captionStyle as CaptionGeometryId) : DEFAULT_CAPTION_GEOMETRY_ID];
  const geometry = captionGeometryForFrame(base, format);
  const box = captionBoxRect(safeZone, format, geometry);
  const fontSize = fitCaptionFontSizeFor(words, box, geometry, format, emphasisIndex);
  const backdropHeightEm = geometry.backdrop === null ? 0 : 2 * geometry.backdrop.paddingYEm;
  const width = Math.min(box.width, Math.round(captionTextWidthEm(words, geometry, emphasisIndex) * fontSize));
  const height = Math.min(box.height, Math.round((geometry.lineHeightEm + backdropHeightEm) * fontSize) * geometry.maxLines);
  return {
    x: box.x + Math.round((box.width - width) / 2),
    y: box.y + Math.round((box.height - height) / 2),
    width,
    height,
  };
}

export function pipRect(format: CaptionFrame, aspectRatio: number): CaptionRect {
  const width = Math.round(format.width * PIP_WIDTH_RATIO);
  const height = Math.round(width / aspectRatio);
  const margin = Math.round(format.width * PIP_MARGIN_RATIO);
  return { x: format.width - margin - width, y: format.height - margin - height, width, height };
}
