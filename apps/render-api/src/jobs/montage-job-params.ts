import { MONTAGE_PRESETS } from '@video-maker/auto-montage';
import type { LogoMode, MontagePresetName, VoiceSource } from '@video-maker/auto-montage';
import { CAPTION_STYLES, isCaptionStyle } from '@video-maker/timeline-core';
import type { CaptionStyle, OutputPreset } from '@video-maker/timeline-core';
import { OUTPUT_PRESETS } from '@video-maker/timeline-core';

import { PipelineStageError } from '../errors/pipeline-stage-error';

const MONTAGE_PRESET_NAMES = Object.keys(MONTAGE_PRESETS) as readonly MontagePresetName[];

const DEFAULT_MONTAGE_PRESET: MontagePresetName = 'software-demo';
const DEFAULT_MONTAGE_SEED = 0;
const DEFAULT_MONTAGE_OVERWRITE = false;
const DEFAULT_MONTAGE_LOGO: LogoMode = 'auto';
const DEFAULT_MONTAGE_FORMAT: OutputPreset = 'reels-9x16';
const DEFAULT_MONTAGE_VOICE: VoiceSource = 'aroll';
const MONTAGE_VOICE_SOURCES: readonly VoiceSource[] = ['aroll', 'script'];

function isMontagePresetName(value: unknown): value is MontagePresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MONTAGE_PRESETS, value);
}

export function parseMontagePreset(value: unknown): MontagePresetName {
  if (value === undefined) {
    return DEFAULT_MONTAGE_PRESET;
  }

  if (!isMontagePresetName(value)) {
    throw new PipelineStageError({
      code: 'MONTAGE_PRESET_INVALID',
      stage: null,
      expected: `one of ${MONTAGE_PRESET_NAMES.join(', ')}`,
    });
  }

  return value;
}

function isOutputPreset(value: unknown): value is OutputPreset {
  return typeof value === 'string' && (OUTPUT_PRESETS as readonly string[]).includes(value);
}

export function parseMontageFormat(value: unknown): OutputPreset {
  if (value === undefined) {
    return DEFAULT_MONTAGE_FORMAT;
  }

  if (!isOutputPreset(value)) {
    throw new PipelineStageError({
      code: 'MONTAGE_FORMAT_INVALID',
      stage: null,
      resource: 'format',
      expected: `one of ${OUTPUT_PRESETS.join(', ')}`,
    });
  }

  return value;
}

export function parseMontageVoice(value: unknown): VoiceSource {
  if (value === undefined) {
    return DEFAULT_MONTAGE_VOICE;
  }

  if (typeof value !== 'string' || !(MONTAGE_VOICE_SOURCES as readonly string[]).includes(value)) {
    throw new PipelineStageError({
      code: 'MONTAGE_VOICE_INVALID',
      stage: null,
      resource: 'voice',
      expected: `one of ${MONTAGE_VOICE_SOURCES.join(', ')}`,
    });
  }

  return value as VoiceSource;
}

export function parseMontageCaptionStyle(value: unknown): CaptionStyle | null {
  if (value === undefined) {
    return null;
  }

  if (!isCaptionStyle(value)) {
    throw new PipelineStageError({
      code: 'MONTAGE_CAPTION_STYLE_INVALID',
      stage: null,
      resource: 'captionStyle',
      expected: `one of ${CAPTION_STYLES.join(', ')}`,
    });
  }

  return value;
}

export function parseMontageSeed(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_MONTAGE_SEED;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new PipelineStageError({
      code: 'MONTAGE_SEED_INVALID',
      stage: null,
      expected: 'a non-negative integer',
    });
  }

  return value;
}

export function parseMontageOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_MONTAGE_OVERWRITE;
  }

  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'MONTAGE_OVERWRITE_INVALID',
      stage: null,
      expected: 'a boolean',
    });
  }

  return value;
}

export interface MontageScriptInput {
  readonly scriptPath: string | null;
  readonly scriptText: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function scriptInvalid(expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'MONTAGE_SCRIPT_INVALID', stage: null, expected });
}

export function parseMontageScript(rawPath: unknown, rawText: unknown): MontageScriptInput {
  if (rawPath !== undefined && rawText !== undefined) {
    throw scriptInvalid('at most one of scriptPath or scriptText');
  }

  if (rawPath !== undefined && !isNonEmptyString(rawPath)) {
    throw scriptInvalid('a non-empty project-relative path to the script');
  }

  if (rawText !== undefined && !isNonEmptyString(rawText)) {
    throw scriptInvalid('a non-empty script');
  }

  return {
    scriptPath: isNonEmptyString(rawPath) ? rawPath : null,
    scriptText: isNonEmptyString(rawText) ? rawText : null,
  };
}

export function parseMontageLogo(value: unknown): LogoMode {
  if (value === undefined) {
    return DEFAULT_MONTAGE_LOGO;
  }

  if (value !== 'auto' && value !== 'off') {
    throw new PipelineStageError({
      code: 'MONTAGE_LOGO_INVALID',
      stage: null,
      expected: "'auto' or 'off'",
    });
  }

  return value;
}

export function assertBrandCaptionStyleHasBrand(captionStyle: CaptionStyle | null | undefined, hasBrand: boolean): void {
  if (captionStyle === 'brand' && !hasBrand) {
    throw new PipelineStageError({
      code: 'MONTAGE_CAPTION_STYLE_INVALID',
      stage: null,
      resource: 'captionStyle',
      expected: 'a project with a brand to use the "brand" caption style',
    });
  }
}
