import { z } from 'zod';

import { DEFAULT_MUSIC_REFERENCE_LUFS } from '../audio/music-normalization';
import { DbSchema, FrameSchema } from './primitives';

export const VoiceTargetSchema = z.object({
  integratedLufs: z.number().default(-14),
  truePeakDbtp: z.number().default(-1),
  loudnessRange: z.number().default(11),
});

export const MusicMixSettingsSchema = z.object({
  baseGainDb: z.number().default(-12),
  duckedGainDb: z.number().default(-24),
  referenceLufs: z.number().max(0).default(DEFAULT_MUSIC_REFERENCE_LUFS),
  attackMs: z.number().int().default(150),
  releaseMs: z.number().int().default(400),
  holdMs: z.number().int().default(250),
  mode: z.enum(['bed', 'segments']).optional().describe('segments: music plays full in the intro, the outro and the voice-free gaps of 2 s or more and drops to duckedGainDb while someone speaks; absent means the continuous bed.'),
});

export const GainKeyframeSchema = z.strictObject({
  frame: FrameSchema,
  gainDb: DbSchema,
});

export const AudioMixPlanSchema = z.strictObject({
  voice: VoiceTargetSchema,
  music: MusicMixSettingsSchema,
  automation: z.array(GainKeyframeSchema),
});

export type VoiceTarget = z.infer<typeof VoiceTargetSchema>;
export type MusicMixSettings = z.infer<typeof MusicMixSettingsSchema>;
export type GainKeyframe = z.infer<typeof GainKeyframeSchema>;
export type AudioMixPlan = z.infer<typeof AudioMixPlanSchema>;
