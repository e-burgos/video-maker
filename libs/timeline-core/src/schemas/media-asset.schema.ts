import { z } from 'zod';

export const MediaKindSchema = z.enum(['video', 'image', 'audio']);
export const MediaRotationSchema = z.literal([0, 90, 180, 270]);

export const MediaAssetAudioSchema = z.object({
  sampleRate: z.number().int(),
  channels: z.number().int().min(1),
  codec: z.string().optional(),
  integratedLufs: z.number().optional(),
});

export const MediaAssetSchema = z
  .strictObject({
    id: z.string().min(1),
    kind: MediaKindSchema,
    path: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
    fps: z.number().gt(0).optional(),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
    rotation: MediaRotationSchema.optional(),
    hasAudio: z.boolean().optional(),
    hasAlpha: z.boolean().optional(),
    audio: MediaAssetAudioSchema.optional(),
    videoCodec: z.string().optional(),
    probedAt: z.iso.datetime(),
  })
  .superRefine((asset, ctx) => {
    if (asset.kind === 'image') {
      if (asset.durationMs !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationMs'],
          message: 'Un MediaAsset kind=image debe tener durationMs = 0.',
        });
      }
      if (asset.fps !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fps'],
          message: 'Un MediaAsset kind=image no declara fps.',
        });
      }
    }

    if (asset.kind === 'video') {
      if (asset.fps === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fps'],
          message: 'Un MediaAsset kind=video requiere fps.',
        });
      }
      if (asset.width === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['width'],
          message: 'Un MediaAsset kind=video requiere width.',
        });
      }
      if (asset.height === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['height'],
          message: 'Un MediaAsset kind=video requiere height.',
        });
      }
      if (asset.hasAudio === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['hasAudio'],
          message: 'Un MediaAsset kind=video requiere hasAudio.',
        });
      }
    }
  });

export type MediaKind = z.infer<typeof MediaKindSchema>;
export type MediaAssetAudio = z.infer<typeof MediaAssetAudioSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
