import type { OutputFormat } from '@video-maker/timeline-core';
import { safeZoneFor } from '@video-maker/timeline-core';
import { captionBoxFor } from './caption-box';
import { captionPreset } from './caption-preset';
import type { CaptionPresetId } from './caption-preset';

export type SceneThemeRole = 'title' | 'text' | 'code' | 'placeholder';

export interface SceneTheme {
  background: string;
  accent: string;
  color: string;
  mutedColor: string;
  fontFamily: string;
  monoFontFamily: string;
  fontWeight: number;
  letterSpacingEm: number;
  lineHeightEm: number;
  textTransform: 'none' | 'uppercase';
  fontSize: number;
  subtitleFontSize: number;
  paddingX: number;
  paddingY: number;
  paddingBottom: number;
}

const MONO_FONT_FAMILY = "'JetBrains Mono', 'Fira Code', Menlo, Consolas, 'Courier New', monospace";

const SCENE_BACKGROUND = '#0b0d12';
const SCENE_MUTED_COLOR = 'rgba(255, 255, 255, 0.62)';

const FONT_SIZE_RATIO: Record<SceneThemeRole, number> = {
  title: 0.092,
  text: 0.058,
  code: 0.034,
  placeholder: 0.036,
};

const SUBTITLE_RATIO = 0.52;
const PADDING_X_RATIO = 0.09;
const PADDING_Y_RATIO = 0.08;

export function captionBandTop(format: OutputFormat, presetId?: CaptionPresetId | undefined): number {
  return captionBoxFor(safeZoneFor(format), format, captionPreset(presetId)).y;
}

function shorterSide(format: OutputFormat): number {
  return Math.min(format.width, format.height);
}

export function sceneTheme(
  role: SceneThemeRole,
  format: OutputFormat,
  presetId?: CaptionPresetId | undefined,
): SceneTheme {
  const preset = captionPreset(presetId);
  const reference = shorterSide(format);
  const fontSize = Math.round(reference * FONT_SIZE_RATIO[role]);

  return {
    background: SCENE_BACKGROUND,
    accent: preset.emphasisColor,
    color: preset.color,
    mutedColor: SCENE_MUTED_COLOR,
    fontFamily: preset.fontFamily,
    monoFontFamily: MONO_FONT_FAMILY,
    fontWeight: role === 'title' ? preset.emphasisFontWeight : preset.fontWeight,
    letterSpacingEm: preset.letterSpacingEm,
    lineHeightEm: role === 'code' ? 1.5 : preset.lineHeightEm,
    textTransform: role === 'title' ? preset.textTransform : 'none',
    fontSize,
    subtitleFontSize: Math.round(fontSize * SUBTITLE_RATIO),
    paddingX: Math.round(format.width * PADDING_X_RATIO),
    paddingY: Math.round(format.height * PADDING_Y_RATIO),
    paddingBottom: format.height - captionBandTop(format, presetId),
  };
}
