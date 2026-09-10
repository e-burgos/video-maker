import type { CSSProperties } from 'react';
import type { CaptionPreset } from './caption-preset';

export interface CaptionWordState {
  isEmphasis: boolean;
  isActive: boolean;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveScale(preset: CaptionPreset, state: CaptionWordState): number {
  if (state.isEmphasis && state.isActive) {
    return round3(preset.emphasisScale * preset.activeScale);
  }

  if (state.isEmphasis) {
    return preset.emphasisScale;
  }

  if (state.isActive) {
    return preset.activeScale;
  }

  return 1;
}

function scaledWidthReserveEm(preset: CaptionPreset, scale: number, characterCount: number): number {
  const wordWidthEm = characterCount * (preset.averageCharWidthEm + preset.letterSpacingEm);
  return round3(((scale - 1) / 2) * wordWidthEm);
}

export function captionWordStyle(
  preset: CaptionPreset,
  state: CaptionWordState,
  characterCount = 0,
): CSSProperties {
  const fontWeight = state.isEmphasis ? preset.emphasisFontWeight : preset.fontWeight;
  const color = state.isEmphasis
    ? preset.emphasisColor
    : state.isActive
      ? preset.activeColor
      : preset.color;
  const scale = resolveScale(preset, state);
  const reserveEm = scaledWidthReserveEm(preset, scale, characterCount);

  return {
    ...(reserveEm > 0 ? { marginLeft: `${reserveEm}em`, marginRight: `${reserveEm}em` } : {}),
    fontFamily: preset.fontFamily,
    fontWeight,
    color,
    textTransform: preset.textTransform,
    letterSpacing: `${preset.letterSpacingEm}em`,
    lineHeight: preset.lineHeightEm,
    display: 'inline-block',
    whiteSpace: 'nowrap',
    transform: `scale(${scale})`,
    transformOrigin: '50% 50%',
    ...(preset.stroke === null
      ? {}
      : {
          WebkitTextStroke: `${preset.stroke.widthEm}em ${preset.stroke.color}`,
          paintOrder: 'stroke fill',
        }),
    ...(preset.shadow === null ? {} : { textShadow: preset.shadow }),
    ...(preset.pill === null
      ? {}
      : {
          backgroundColor: state.isEmphasis ? preset.pill.emphasisColor : preset.pill.color,
          padding: `${preset.pill.paddingYEm}em ${preset.pill.paddingXEm}em`,
          borderRadius: `${preset.pill.radiusEm}em`,
        }),
  };
}
