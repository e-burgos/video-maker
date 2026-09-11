import type { MontagePresetName, VoiceSource } from '@video-maker/auto-montage';
import { OUTPUT_PRESETS } from '@video-maker/timeline-core';
import type { OutputPreset } from '@video-maker/timeline-core';

export const PRESET_NAMES = ['software-demo', 'hardware', 'recipe', 'educational'] as const satisfies readonly MontagePresetName[];

export const COMMAND_NAMES = ['ingest', 'plan', 'render', 'run'] as const;

export const DEFAULT_SEED = 0;

export const FORMAT_NAMES = OUTPUT_PRESETS;

export const DEFAULT_FORMAT: OutputPreset = 'reels-9x16';

export const VOICE_SOURCE_NAMES = ['aroll', 'script'] as const satisfies readonly VoiceSource[];

export const DEFAULT_VOICE_SOURCE: VoiceSource = 'aroll';
