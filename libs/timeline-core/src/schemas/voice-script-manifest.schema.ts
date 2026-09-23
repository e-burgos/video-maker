import { z } from 'zod';

import { IdSchema, MsSchema } from './primitives';

export const VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION = 1;

export const DEFAULT_VOICE_SCRIPT_GAP_MS = 900;

export const VoiceScriptWordsSourceSchema = z.enum(['whisper', 'script']);

export const VoiceScriptLineSchema = z.strictObject({
  index: z.number().int().min(1),
  text: z.string().min(1),
  path: z.string().min(1).describe('Project-relative path of the wav synthesized for this line.'),
  startMs: MsSchema.describe('Offset of this line inside the concatenated track.'),
  durationMs: MsSchema,
  endMs: MsSchema.optional().describe('Offset at which this line stops sounding.'),
  requestedStartMs: MsSchema.nullable()
    .optional()
    .describe('Start the time mark of the script asked for, null when the line carries no mark.'),
  overflowMs: MsSchema.optional().describe(
    'Milliseconds the line could not fit in its window after shortening the pause and speeding up the synthesis.',
  ),
  lengthScale: z
    .number()
    .gt(0)
    .max(1)
    .optional()
    .describe('--vits-length-scale used for this line; absent or 1 means the natural pace.'),
  wordsSource: VoiceScriptWordsSourceSchema.optional().describe(
    'Where the word timings of this line came from: whisper over its own wav, or the script spread evenly over its window.',
  ),
});

export const VoiceScriptManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION),
    source: z.literal('script'),
    language: z.string().min(2),
    voiceId: IdSchema,
    gapMs: MsSchema,
    path: z.string().min(1).describe('Project-relative path of the concatenated 48 kHz mono track.'),
    wordsPath: z.string().min(1).describe('Project-relative path of the Transcription document of that track.'),
    durationMs: MsSchema,
    sampleRate: z.number().int().min(1),
    updatedAt: z.iso.datetime(),
    lines: z.array(VoiceScriptLineSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    manifest.lines.forEach((line, position) => {
      if (line.index !== position + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', position, 'index'],
          message: 'Las líneas del guion van numeradas desde 1 y en orden.',
        });
      }
    });
  });

export type VoiceScriptWordsSource = z.infer<typeof VoiceScriptWordsSourceSchema>;
export type VoiceScriptLine = z.infer<typeof VoiceScriptLineSchema>;
export type VoiceScriptManifest = z.infer<typeof VoiceScriptManifestSchema>;

export function voiceScriptManifestIsTimed(manifest: VoiceScriptManifest): boolean {
  return manifest.lines.some((line) => (line.requestedStartMs ?? null) !== null);
}

export function splitVoiceScriptLines(scriptText: string): readonly string[] {
  return scriptText
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line !== '');
}
