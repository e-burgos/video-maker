import { z } from 'zod';

import { AudioMixPlanSchema } from './audio-mix-plan.schema';
import { MediaAssetSchema } from './media-asset.schema';
import { OutputFormatSchema, SafeZoneSchema } from './output-format.schema';
import { DbSchema, FrameSchema, IdSchema, MsSchema } from './primitives';

type IssueCtx = z.core.$RefinementCtx<unknown>;

export const ClipFitSchema = z.enum(['cover', 'contain', 'pip']);
export const TimelineTransitionKindSchema = z.enum(['fade', 'slide', 'whip-pan', 'light-leak']);
export const TimelineTransitionDirectionSchema = z.enum([
  'from-left',
  'from-right',
  'from-top',
  'from-bottom',
]);

export const ClipTransformSchema = z.object({
  scale: z.number(),
  translateX: z.number(),
  translateY: z.number(),
});

export const VideoClipSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  from: FrameSchema,
  durationFrames: z.number().int().min(1),
  trimStartMs: MsSchema,
  fit: ClipFitSchema.optional(),
  transform: ClipTransformSchema,
  muted: z.boolean().optional(),
});

export const AudioClipSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  from: FrameSchema,
  durationFrames: z.number().int().min(1),
  trimStartMs: MsSchema,
  gainDb: DbSchema,
  fadeInFrames: FrameSchema.optional(),
  fadeOutFrames: FrameSchema.optional(),
});

export const CaptionClipWordSchema = z.object({
  text: z.string().min(1),
  fromFrame: FrameSchema,
  durationFrames: z.number().int().min(1),
});

export const CaptionClipBoxSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
});

export const CaptionClipSchema = z.object({
  id: IdSchema,
  from: FrameSchema,
  durationFrames: z.number().int().min(1),
  words: z.array(CaptionClipWordSchema).min(1).max(3),
  emphasisIndex: z.number().int().nonnegative().optional(),
  box: CaptionClipBoxSchema.optional(),
});

export const TransitionTimingSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('linear') }),
  z.strictObject({
    type: z.literal('spring'),
    damping: z.number(),
    stiffness: z.number(),
    mass: z.number(),
  }),
]);

export const TimelineTransitionSchema = z.object({
  betweenClipIds: z.array(IdSchema).min(2).max(2),
  kind: TimelineTransitionKindSchema,
  direction: TimelineTransitionDirectionSchema.optional(),
  durationFrames: z.number().int().min(1),
  timing: TransitionTimingSchema,
});

export const TimelineTracksSchema = z.strictObject({
  aroll: z.array(VideoClipSchema),
  broll: z.array(VideoClipSchema),
  voice: z.array(AudioClipSchema),
  music: z.array(AudioClipSchema),
  captions: z.array(CaptionClipSchema),
});

const CLIP_TRACK_NAMES = ['aroll', 'broll', 'voice', 'music', 'captions'] as const;

function validateUniqueClipIds(tracks: z.infer<typeof TimelineTracksSchema>, ctx: IssueCtx): void {
  const firstLocationById = new Map<string, string>();

  CLIP_TRACK_NAMES.forEach((trackName) => {
    tracks[trackName].forEach((clip, index) => {
      const firstLocation = firstLocationById.get(clip.id);
      if (firstLocation !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', trackName, index, 'id'],
          message: `El id de clip "${clip.id}" ya fue usado en ${firstLocation}.`,
        });
        return;
      }
      firstLocationById.set(clip.id, `tracks.${trackName}[${index}]`);
    });
  });
}

export const TimelineSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: IdSchema,
    format: OutputFormatSchema,
    durationFrames: z.number().int().min(1),
    assets: z.array(MediaAssetSchema),
    tracks: TimelineTracksSchema,
    transitions: z.array(TimelineTransitionSchema).optional(),
    audioMix: AudioMixPlanSchema,
    safeZone: SafeZoneSchema.optional(),
  })
  .superRefine((timeline, ctx) => {
    validateUniqueClipIds(timeline.tracks, ctx);
  });

export type ClipFit = z.infer<typeof ClipFitSchema>;
export type ClipTransform = z.infer<typeof ClipTransformSchema>;
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type CaptionClipWord = z.infer<typeof CaptionClipWordSchema>;
export type CaptionClipBox = z.infer<typeof CaptionClipBoxSchema>;
export type CaptionClip = z.infer<typeof CaptionClipSchema>;
export type TransitionTiming = z.infer<typeof TransitionTimingSchema>;
export type TimelineTransition = z.infer<typeof TimelineTransitionSchema>;
export type TimelineTracks = z.infer<typeof TimelineTracksSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
