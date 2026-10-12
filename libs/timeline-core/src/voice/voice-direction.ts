import { z } from 'zod';

export const VOICE_PACES = ['slow', 'normal', 'fast'] as const;
export const VOICE_ENERGIES = ['calm', 'neutral', 'lively'] as const;
export const MAX_VOICE_PAUSE_AFTER_MS = 2000;

export const VoiceDirectionSchema = z.strictObject({
  intent: z.string().trim().min(1).max(240).optional().describe('Free-text delivery intent, e.g. "reassuring, closing the idea".'),
  pace: z.enum(VOICE_PACES).optional().describe('slow stretches the line 12%, fast shortens it 8%; normal leaves the voice pace untouched.'),
  energy: z.enum(VOICE_ENERGIES).optional().describe('calm lowers the prosody variation of the voice, lively raises it; neutral leaves the model defaults.'),
  pauseAfterMs: z.number().int().min(0).max(MAX_VOICE_PAUSE_AFTER_MS).optional().describe('Silence appended after the line.'),
  emphasis: z.array(z.string().trim().min(1)).max(8).optional().describe('Words to stress; recorded for engines that support it, ignored by Piper.'),
});

export type VoiceDirection = z.infer<typeof VoiceDirectionSchema>;
export type VoicePace = (typeof VOICE_PACES)[number];
export type VoiceEnergy = (typeof VOICE_ENERGIES)[number];

export interface VoiceDirectionSynthesis {
  readonly lengthScaleFactor: number;
  readonly noiseScale?: number;
  readonly noiseScaleW?: number;
  readonly trailingPauseMs: number;
}

const PACE_LENGTH_SCALE_FACTOR: Record<VoicePace, number> = { slow: 1.12, normal: 1, fast: 0.92 };

const ENERGY_NOISE: Record<VoiceEnergy, { noiseScale: number; noiseScaleW: number } | null> = {
  calm: { noiseScale: 0.5, noiseScaleW: 0.6 },
  neutral: null,
  lively: { noiseScale: 0.8, noiseScaleW: 1 },
};

export function voiceDirectionSynthesis(direction: VoiceDirection | undefined): VoiceDirectionSynthesis {
  const noise = ENERGY_NOISE[direction?.energy ?? 'neutral'];
  return {
    lengthScaleFactor: PACE_LENGTH_SCALE_FACTOR[direction?.pace ?? 'normal'],
    ...(noise === null ? {} : noise),
    trailingPauseMs: direction?.pauseAfterMs ?? 0,
  };
}

export function directedLengthScale(baseLengthScale: number, direction: VoiceDirection | undefined): number {
  return Math.round(baseLengthScale * voiceDirectionSynthesis(direction).lengthScaleFactor * 1000) / 1000;
}

export function hasVoiceDirection(direction: VoiceDirection | undefined): direction is VoiceDirection {
  return direction !== undefined && Object.keys(direction).length > 0;
}

export const VoiceScriptDirectionsSchema = z.record(
  z.string().regex(/^[1-9][0-9]*$/u, 'line numbers start at 1'),
  VoiceDirectionSchema,
);

export type VoiceScriptDirections = z.infer<typeof VoiceScriptDirectionsSchema>;
