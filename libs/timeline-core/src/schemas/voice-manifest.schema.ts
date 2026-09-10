import { z } from 'zod';

import { IdSchema, MsSchema } from './primitives';

export const VOICE_MANIFEST_SCHEMA_VERSION = 1;

export const VoiceTrackSourceSchema = z.enum(['generated', 'uploaded']);

export const VoiceTrackSchema = z.strictObject({
  sceneId: IdSchema,
  index: z.number().int().min(1),
  source: VoiceTrackSourceSchema,
  path: z.string().min(1).describe('Project-relative path of the mixable wav for this scene.'),
  wordsPath: z.string().min(1).describe('Project-relative path of the Transcription document of this wav.'),
  durationMs: MsSchema.describe('Real duration measured with ffprobe. It supersedes estimatedDurationMs.'),
  sampleRate: z.number().int().min(1),
  voiceId: IdSchema.nullable().describe('Piper voice model id, or null when the track was uploaded.'),
  narrationHash: z
    .string()
    .min(1)
    .describe('Hash of the narration this track was produced from, to detect a later text edit.'),
  updatedAt: z.iso.datetime(),
});

export const VoiceManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(VOICE_MANIFEST_SCHEMA_VERSION),
    storyboardId: IdSchema,
    language: z.string().min(2),
    tracks: z.array(VoiceTrackSchema),
  })
  .superRefine((manifest, ctx) => {
    const sceneIds = new Set(manifest.tracks.map((track) => track.sceneId));
    if (sceneIds.size !== manifest.tracks.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['tracks'],
        message: 'Una escena tiene a lo sumo una pista de voz en el manifest.',
      });
    }

    manifest.tracks.forEach((track, position) => {
      const previous = manifest.tracks[position - 1];
      if (previous !== undefined && previous.index > track.index) {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', position, 'index'],
          message: 'Las pistas del manifest van ordenadas por el index de su escena.',
        });
      }
      if (track.source === 'uploaded' && track.voiceId !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', position, 'voiceId'],
          message: 'Una pista source=uploaded no declara voiceId.',
        });
      }
      if (track.source === 'generated' && track.voiceId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', position, 'voiceId'],
          message: 'Una pista source=generated requiere el voiceId con el que se sintetizó.',
        });
      }
    });
  });

export type VoiceTrackSource = z.infer<typeof VoiceTrackSourceSchema>;
export type VoiceTrack = z.infer<typeof VoiceTrackSchema>;
export type VoiceManifest = z.infer<typeof VoiceManifestSchema>;

export function emptyVoiceManifest(storyboardId: string, language: string): VoiceManifest {
  return {
    schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION,
    storyboardId,
    language,
    tracks: [],
  };
}
