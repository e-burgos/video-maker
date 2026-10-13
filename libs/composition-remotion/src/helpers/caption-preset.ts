import { CAPTION_GEOMETRY, captionGeometryForFrame, PORTRAIT_MAX_SIDE_PADDING_RATIO as TIMELINE_PORTRAIT_MAX_SIDE_PADDING_RATIO } from '@video-maker/timeline-core';
import type { CaptionGeometry } from '@video-maker/timeline-core';
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

export interface CaptionBackdrop {
  color: string;
  paddingXEm: number;
  paddingYEm: number;
  radiusEm: number;
}

export interface CaptionPreset extends Omit<CaptionGeometry, 'backdrop'> {
  id: CaptionPresetId;
  fontFamily: string;
  fontWeight: number;
  emphasisFontWeight: number;
  color: string;
  emphasisColor: string;
  activeColor: string;
  textTransform: CaptionTextTransform;
  stroke: CaptionStroke | null;
  shadow: string | null;
  pill: CaptionPill | null;
  backdrop: CaptionBackdrop | null;
  animation: CaptionAnimation;
}

function withoutBackdrop(id: CaptionPresetId): Omit<CaptionGeometry, 'backdrop'> {
  const entries = Object.entries(CAPTION_GEOMETRY[id]).filter(([key]) => key !== 'backdrop');
  return Object.fromEntries(entries) as Omit<CaptionGeometry, 'backdrop'>;
}

const SUBTLE_LOWER_BACKDROP_PADDING = CAPTION_GEOMETRY['subtle-lower'].backdrop as NonNullable<CaptionGeometry['backdrop']>;

export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionPreset> = {
  'bold-impact': {
    id: 'bold-impact',
    ...withoutBackdrop('bold-impact'),
    fontFamily: "'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 800,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ffe45e',
    activeColor: '#ffffff',
    textTransform: 'uppercase',
    stroke: { widthEm: 0.02, color: '#000000' },
    shadow: '0 0.04em 0.12em rgba(0, 0, 0, 0.85)',
    pill: null,
    backdrop: null,
    animation: {
      mode: 'pop',
      spring: { damping: 9, mass: 0.6, stiffness: 140 },
      enterDurationFrames: 8,
      enterScale: 0.72,
    },
  },
  'clean-sans': {
    id: 'clean-sans',
    ...withoutBackdrop('clean-sans'),
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    emphasisFontWeight: 800,
    color: '#ffffff',
    emphasisColor: '#4ade80',
    activeColor: '#ffffff',
    textTransform: 'none',
    stroke: null,
    shadow: '0 0.03em 0.1em rgba(0, 0, 0, 0.7)',
    pill: null,
    backdrop: null,
    animation: {
      mode: 'rise',
      spring: { damping: 14, mass: 0.8, stiffness: 120 },
      enterDurationFrames: 10,
      riseDistanceEm: 0.55,
    },
  },
  'outline-pop': {
    id: 'outline-pop',
    ...withoutBackdrop('outline-pop'),
    fontFamily: "'Poppins', 'Trebuchet MS', 'Segoe UI', sans-serif",
    fontWeight: 700,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ff4d6d',
    activeColor: '#ffd166',
    textTransform: 'uppercase',
    stroke: { widthEm: 0.045, color: '#101010' },
    shadow: '0 0.05em 0.14em rgba(0, 0, 0, 0.6)',
    pill: null,
    backdrop: null,
    animation: {
      mode: 'pop',
      spring: { damping: 10, mass: 0.7, stiffness: 160 },
      enterDurationFrames: 9,
      enterScale: 0.66,
    },
  },
  'subtle-lower': {
    id: 'subtle-lower',
    ...withoutBackdrop('subtle-lower'),
    fontFamily: "'Inter', system-ui, 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    emphasisFontWeight: 600,
    color: '#ffffff',
    emphasisColor: '#ffffff',
    activeColor: '#ffffff',
    textTransform: 'none',
    stroke: null,
    shadow: '0 0.03em 0.08em rgba(0, 0, 0, 0.75)',
    pill: null,
    backdrop: { color: 'rgba(0, 0, 0, 0.55)', radiusEm: 0.35, ...SUBTLE_LOWER_BACKDROP_PADDING },
    animation: {
      mode: 'fade',
      spring: { damping: 30, mass: 1, stiffness: 120 },
      enterDurationFrames: 4,
    },
  },
  brand: {
    id: 'brand',
    ...withoutBackdrop('brand'),
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 700,
    emphasisFontWeight: 800,
    color: '#ffffff',
    emphasisColor: '#4ade80',
    activeColor: '#ffffff',
    textTransform: 'none',
    stroke: null,
    shadow: null,
    pill: { color: '#09090b', emphasisColor: '#09090b', paddingXEm: 0.22, paddingYEm: 0.06, radiusEm: 0.2 },
    backdrop: null,
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

export const PORTRAIT_MAX_SIDE_PADDING_RATIO = TIMELINE_PORTRAIT_MAX_SIDE_PADDING_RATIO;

export function captionPresetForFrame(preset: CaptionPreset, frame: { readonly width: number; readonly height: number }): CaptionPreset {
  return captionGeometryForFrame(preset, frame);
}
