import type { MontagePresetName } from '@video-maker/auto-montage';

export const PRESET_NAMES = ['software-demo', 'hardware', 'recipe', 'educational'] as const satisfies readonly MontagePresetName[];

export const COMMAND_NAMES = ['ingest', 'plan', 'render', 'run'] as const;

export const DEFAULT_SEED = 0;
