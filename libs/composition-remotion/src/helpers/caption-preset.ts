import type { CaptionAnchor } from './caption-box';
import type { CaptionAnimation } from './caption-animation';

export type CaptionPresetId = 'bold-impact' | 'clean-sans' | 'outline-pop' | 'subtle-lower' | 'brand';

export type CaptionTextTransform = 'none' | 'uppercase';

export interface CaptionStroke {
  widthEm: number;
  color: string;
}

export interface CaptionPill {
  color: string;
  emphasisColor: string;
  paddingXEm: number;
  paddingYEm: number;
  radiusEm: number;
}

export interface CaptionPreset {
  id: CaptionPresetId;
  fontFamily: string;
  fontWeight: number;
  emphasisFontWeight: number;
  color: string;
  emphasisColor: string;
  activeColor: string;
  emphasisScale: number;
  activeScale: number;
  textTransform: CaptionTextTransform;
  letterSpacingEm: number;
  lineHeightEm: number;
  wordGapEm: number;
  averageCharWidthEm: number;
  anchor: CaptionAnchor;
  maxLines: number;
  boxHeightRatio: number;
  sidePaddingRatio: number;
  minFontSizeRatio: number;
  maxFontSizeRatio: number;
  stroke: CaptionStroke | null;
  shadow: string | null;
  pill: CaptionPill | null;
  animation: CaptionAnimation;
}

export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionPreset> = {
  'bold-impact': {
    id: 'bold-impact',
    fontFamily: "'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 800,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ffe45e',
    activeColor: '#ffffff',
    emphasisScale: 1.12,
    activeScale: 1.08,
    textTransform: 'uppercase',
    letterSpacingEm: 0.02,
    lineHeightEm: 1.1,
    wordGapEm: 0.3,
    averageCharWidthEm: 0.62,
    anchor: 'center',
    maxLines: 1,
    boxHeightRatio: 0.24,
    sidePaddingRatio: 0.04,
    minFontSizeRatio: 0.045,
    maxFontSizeRatio: 0.11,
    stroke: { widthEm: 0.02, color: '#000000' },
    shadow: '0 0.04em 0.12em rgba(0, 0, 0, 0.85)',
    pill: null,
    animation: {
      mode: 'pop',
      spring: { damping: 9, mass: 0.6, stiffness: 140 },
      enterDurationFrames: 8,
      enterScale: 0.72,
    },
  },
  'clean-sans': {
    id: 'clean-sans',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    emphasisFontWeight: 800,
    color: '#ffffff',
    emphasisColor: '#4ade80',
    activeColor: '#ffffff',
    emphasisScale: 1.08,
    activeScale: 1.06,
    textTransform: 'none',
    letterSpacingEm: 0,
    lineHeightEm: 1.15,
    wordGapEm: 0.28,
    averageCharWidthEm: 0.52,
    anchor: 'bottom',
    maxLines: 1,
    boxHeightRatio: 0.18,
    sidePaddingRatio: 0.05,
    minFontSizeRatio: 0.035,
    maxFontSizeRatio: 0.075,
    stroke: null,
    shadow: '0 0.03em 0.1em rgba(0, 0, 0, 0.7)',
    pill: null,
    animation: {
      mode: 'rise',
      spring: { damping: 14, mass: 0.8, stiffness: 120 },
      enterDurationFrames: 10,
      riseDistanceEm: 0.55,
    },
  },
  'outline-pop': {
    id: 'outline-pop',
    fontFamily: "'Poppins', 'Trebuchet MS', 'Segoe UI', sans-serif",
    fontWeight: 700,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ff4d6d',
    activeColor: '#ffd166',
    emphasisScale: 1.14,
    activeScale: 1.1,
    textTransform: 'uppercase',
    letterSpacingEm: 0.01,
    lineHeightEm: 1.1,
    wordGapEm: 0.32,
    averageCharWidthEm: 0.6,
    anchor: 'center',
    maxLines: 1,
    boxHeightRatio: 0.22,
    sidePaddingRatio: 0.04,
    minFontSizeRatio: 0.04,
    maxFontSizeRatio: 0.1,
    stroke: { widthEm: 0.045, color: '#101010' },
    shadow: '0 0.05em 0.14em rgba(0, 0, 0, 0.6)',
    pill: null,
    animation: {
      mode: 'pop',
      spring: { damping: 10, mass: 0.7, stiffness: 160 },
      enterDurationFrames: 9,
      enterScale: 0.66,
    },
  },
  'subtle-lower': {
    id: 'subtle-lower',
    fontFamily: "'Inter', system-ui, 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    emphasisFontWeight: 600,
    color: '#ffffff',
    emphasisColor: '#ffffff',
    activeColor: '#ffffff',
    emphasisScale: 1,
    activeScale: 1,
    textTransform: 'none',
    letterSpacingEm: 0.005,
    lineHeightEm: 1.28,
    wordGapEm: 0.26,
    averageCharWidthEm: 0.52,
    anchor: 'bottom',
    maxLines: 2,
    boxHeightRatio: 0.15,
    sidePaddingRatio: 0.2,
    minFontSizeRatio: 0.03,
    maxFontSizeRatio: 0.042,
    stroke: { widthEm: 0.045, color: 'rgba(0, 0, 0, 0.9)' },
    shadow: '0 0.03em 0.08em rgba(0, 0, 0, 0.75)',
    pill: null,
    animation: {
      mode: 'fade',
      spring: { damping: 30, mass: 1, stiffness: 120 },
      enterDurationFrames: 4,
    },
  },
  brand: {
    id: 'brand',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 700,
    emphasisFontWeight: 800,
    color: '#ffffff',
    emphasisColor: '#4ade80',
    activeColor: '#ffffff',
    emphasisScale: 1.08,
    activeScale: 1.05,
    textTransform: 'none',
    letterSpacingEm: 0,
    lineHeightEm: 1.2,
    wordGapEm: 0.28,
    averageCharWidthEm: 0.54,
    anchor: 'bottom',
    maxLines: 1,
    boxHeightRatio: 0.18,
    sidePaddingRatio: 0.05,
    minFontSizeRatio: 0.035,
    maxFontSizeRatio: 0.07,
    stroke: null,
    shadow: null,
    pill: { color: '#09090b', emphasisColor: '#09090b', paddingXEm: 0.22, paddingYEm: 0.06, radiusEm: 0.2 },
    animation: {
      mode: 'rise',
      spring: { damping: 14, mass: 0.8, stiffness: 120 },
      enterDurationFrames: 10,
      riseDistanceEm: 0.5,
    },
  },
};

export const CAPTION_PRESET_IDS: readonly CaptionPresetId[] = [
  'bold-impact',
  'clean-sans',
  'outline-pop',
  'subtle-lower',
  'brand',
];

export const DEFAULT_CAPTION_PRESET_ID: CaptionPresetId = 'bold-impact';

export function captionPreset(id: CaptionPresetId = DEFAULT_CAPTION_PRESET_ID): CaptionPreset {
  return CAPTION_PRESETS[id] ?? CAPTION_PRESETS[DEFAULT_CAPTION_PRESET_ID];
}
