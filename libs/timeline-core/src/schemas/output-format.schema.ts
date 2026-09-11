import { z } from 'zod';

import { FpsSchema } from './primitives';

export const OutputPresetSchema = z.enum([
  'reels-9x16',
  'tiktok-9x16',
  'shorts-9x16',
  'youtube-16x9',
]);

export const OUTPUT_PRESETS = OutputPresetSchema.options;

export const OutputFormatSchema = z.strictObject({
  preset: OutputPresetSchema,
  width: z.number().int().min(240),
  height: z.number().int().min(240),
  fps: FpsSchema,
});

export const SafeZoneSchema = z.strictObject({
  top: z.number().int(),
  bottom: z.number().int(),
  left: z.number().int(),
  right: z.number().int(),
});

export type OutputPreset = z.infer<typeof OutputPresetSchema>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
export type SafeZone = z.infer<typeof SafeZoneSchema>;
