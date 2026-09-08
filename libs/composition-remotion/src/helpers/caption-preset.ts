import type { CaptionAnchor } from './caption-box';
import type { CaptionAnimation } from './caption-animation';

export type CaptionPresetId = 'bold-impact' | 'clean-sans' | 'outline-pop' | 'subtle-lower';

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
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    fontWeight: 500,
    emphasisFontWeight: 700,
    color: '#f5f5f5',
    emphasisColor: '#ffffff',
    activeColor: '#f5f5f5',
    emphasisScale: 1.05,
    activeScale: 1.03,
    textTransform: 'none',
    letterSpacingEm: 0.005,
    lineHeightEm: 1.2,
    wordGapEm: 0.26,
    averageCharWidthEm: 0.5,
    anchor: 'bottom',
    boxHeightRatio: 0.12,
    sidePaddingRatio: 0.06,
    minFontSizeRatio: 0.028,
    maxFontSizeRatio: 0.05,
    stroke: null,
    shadow: null,
    pill: {
      color: 'rgba(0, 0, 0, 0.55)',
      emphasisColor: 'rgba(0, 0, 0, 0.78)',
      paddingXEm: 0.35,
      paddingYEm: 0.12,
      radiusEm: 0.35,
    },
    animation: {
      mode: 'fade',
      spring: { damping: 30, mass: 1.0, stiffness: 100 },
      enterDurationFrames: 12,
    },
  },
};

export const CAPTION_PRESET_IDS: readonly CaptionPresetId[] = [
  'bold-impact',
  'clean-sans',
  'outline-pop',
  'subtle-lower',
];

export const DEFAULT_CAPTION_PRESET_ID: CaptionPresetId = 'bold-impact';

export function captionPreset(id: CaptionPresetId = DEFAULT_CAPTION_PRESET_ID): CaptionPreset {
  return CAPTION_PRESETS[id] ?? CAPTION_PRESETS[DEFAULT_CAPTION_PRESET_ID];
}
