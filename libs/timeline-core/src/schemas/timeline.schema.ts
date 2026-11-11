import { z } from 'zod';

import { CAPTION_STYLES } from '../captions/caption-style';
import { AudioMixPlanSchema } from './audio-mix-plan.schema';
import { PunchInAnchorSchema } from './edit-decision-list.schema';
import { MediaAssetSchema } from './media-asset.schema';
import { OutputFormatSchema, SafeZoneSchema } from './output-format.schema';
import { DbSchema, FrameSchema, IdSchema, MsSchema } from './primitives';

type IssueCtx = z.core.$RefinementCtx<unknown>;

export const ClipFitSchema = z.enum(['cover', 'contain', 'pip']);
export const TimelineTransitionKindSchema = z.enum(['fade', 'slide', 'whip-pan', 'light-leak', 'wipe', 'flip', 'clock-wipe', 'iris']);
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
  anchor: PunchInAnchorSchema.optional(),
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
  words: z.array(CaptionClipWordSchema).min(1).max(10),
  emphasisIndex: z.number().int().nonnegative().optional(),
  box: CaptionClipBoxSchema.optional(),
});

export const CaptionStyleSchema = z.enum(CAPTION_STYLES);

export const CaptionThemeFontFileSchema = z.strictObject({
  path: z.string().min(1),
  weight: z.string().min(1).optional(),
  unicodeRange: z.string().min(1).optional(),
});

export const CaptionThemeSchema = z.strictObject({
  fontFamily: z.string().min(1),
  fontFiles: z.array(CaptionThemeFontFileSchema).min(1),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  boxColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
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

export const LogoPositionSchema = z.enum([
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
]);

export const LogoOverlaySchema = z.strictObject({
  assetId: IdSchema,
  position: LogoPositionSchema.default('bottom-right'),
  widthRatio: z.number().gt(0).max(1).default(0.32),
  marginRatio: z.number().nonnegative().max(0.5).default(0.035),
  opacity: z.number().gt(0).max(1).default(1),
});

export const LOGO_BUMPER_ANIMATIONS = ['fade', 'zoom', 'slide-up'] as const;

export const LogoBumperAnimationSchema = z.enum(LOGO_BUMPER_ANIMATIONS);

export const LOGO_BUMPER_BACKGROUNDS = ['solid', 'gradient', 'noise', 'shapes', 'glow'] as const;
export const LogoBumperBackgroundSchema = z.enum(LOGO_BUMPER_BACKGROUNDS);

export const LOGO_BUMPER_REVEALS = ['fade', 'zoom', 'slide-up', 'wipe', 'blur-in', 'pop'] as const;
export const LogoBumperRevealSchema = z.enum(LOGO_BUMPER_REVEALS);

export const MAX_LOGO_BUMPER_CAPTION_LENGTH = 60;

export const LOGO_BUMPER_SFX_KINDS = ['whoosh', 'impact', 'shimmer', 'click'] as const;
export const LogoBumperSfxKindSchema = z.enum(LOGO_BUMPER_SFX_KINDS);
export const LogoBumperSfxChoiceSchema = z.enum([...LOGO_BUMPER_SFX_KINDS, 'none']);
export const MAX_BUMPER_SFX_CUES = 6;

export const BumperSfxCueSchema = z.strictObject({
  atMs: MsSchema,
  assetId: IdSchema,
  gainDb: DbSchema.max(0),
  fadeInMs: MsSchema.optional(),
  fadeOutMs: MsSchema.optional(),
});

export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const DEFAULT_LOGO_BUMPER_DURATION_MS = 2000;
export const MIN_LOGO_BUMPER_DURATION_MS = 500;
export const MAX_LOGO_BUMPER_DURATION_MS = 6000;
export const DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_LOGO_BUMPER_WIDTH_RATIO = 0.4;

export const LogoBumperSchema = z.strictObject({
  enabled: z.boolean().default(false),
  durationMs: z
    .number()
    .int()
    .min(MIN_LOGO_BUMPER_DURATION_MS)
    .max(MAX_LOGO_BUMPER_DURATION_MS)
    .default(DEFAULT_LOGO_BUMPER_DURATION_MS),
  backgroundColor: HexColorSchema.default(DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR),
  animation: LogoBumperAnimationSchema.default('zoom'),
  logoWidthRatio: z.number().gt(0).max(1).default(DEFAULT_LOGO_BUMPER_WIDTH_RATIO),
  logoAssetId: IdSchema.optional(),
  background: LogoBumperBackgroundSchema.optional(),
  reveal: LogoBumperRevealSchema.optional(),
  accentColor: HexColorSchema.optional(),
  caption: z.string().trim().min(1).max(MAX_LOGO_BUMPER_CAPTION_LENGTH).optional(),
  sfxKind: LogoBumperSfxChoiceSchema.optional(),
  sfx: z.array(BumperSfxCueSchema).max(MAX_BUMPER_SFX_CUES).optional(),
});

export const BumperStyleSchema = z.strictObject({
  rotate: z.boolean(),
  seed: z.number().int().nonnegative().optional(),
  backgrounds: z.array(LogoBumperBackgroundSchema).min(1).optional(),
  reveals: z.array(LogoBumperRevealSchema).min(1).optional(),
  accentColor: HexColorSchema.optional(),
  secondaryColor: HexColorSchema.optional(),
  outroCaption: z.string().trim().min(1).max(MAX_LOGO_BUMPER_CAPTION_LENGTH).optional(),
});

export const TimelineBumpersSchema = z.strictObject({
  intro: LogoBumperSchema.optional(),
  outro: LogoBumperSchema.optional(),
  style: BumperStyleSchema.optional(),
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

export const DELIVERY_KINDS = ['tutorial', 'motion', 'short'] as const;

export const DeliveryContractSchema = z.strictObject({
  kind: z.enum(DELIVERY_KINDS),
  requiresVoice: z.boolean().optional(),
  requiresCaptions: z.boolean().optional(),
  maxDurationSec: z.number().positive().optional(),
  format: z.string().min(1).optional(),
});

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
    logo: LogoOverlaySchema.optional(),
    bumpers: TimelineBumpersSchema.optional(),
    safeZone: SafeZoneSchema.optional(),
    captionStyle: CaptionStyleSchema.optional(),
    captionTheme: CaptionThemeSchema.optional(),
    delivery: DeliveryContractSchema.optional(),
  })
  .superRefine((timeline, ctx) => {
    validateUniqueClipIds(timeline.tracks, ctx);
    if (timeline.captionStyle === 'brand' && timeline.captionTheme === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['captionTheme'],
        message: 'El estilo de subtítulos "brand" necesita "captionTheme" con la tipografía y los colores de la marca.',
      });
    }
  });

export type DeliveryKind = (typeof DELIVERY_KINDS)[number];
export type DeliveryContract = z.infer<typeof DeliveryContractSchema>;
export type CaptionTheme = z.infer<typeof CaptionThemeSchema>;
export type ClipFit = z.infer<typeof ClipFitSchema>;
export type ClipTransform = z.infer<typeof ClipTransformSchema>;
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type CaptionClipWord = z.infer<typeof CaptionClipWordSchema>;
export type CaptionClipBox = z.infer<typeof CaptionClipBoxSchema>;
export type CaptionClip = z.infer<typeof CaptionClipSchema>;
export type TransitionTiming = z.infer<typeof TransitionTimingSchema>;
export type TimelineTransition = z.infer<typeof TimelineTransitionSchema>;
export type LogoPosition = z.infer<typeof LogoPositionSchema>;
export type LogoOverlay = z.infer<typeof LogoOverlaySchema>;
export type LogoBumperAnimation = z.infer<typeof LogoBumperAnimationSchema>;
export type LogoBumper = z.infer<typeof LogoBumperSchema>;
export type TimelineBumpers = z.infer<typeof TimelineBumpersSchema>;
export type LogoBumperBackground = z.infer<typeof LogoBumperBackgroundSchema>;
export type LogoBumperReveal = z.infer<typeof LogoBumperRevealSchema>;
export type BumperStyle = z.infer<typeof BumperStyleSchema>;
export type LogoBumperSfxKind = z.infer<typeof LogoBumperSfxKindSchema>;
export type LogoBumperSfxChoice = z.infer<typeof LogoBumperSfxChoiceSchema>;
export type BumperSfxCue = z.infer<typeof BumperSfxCueSchema>;
export type TimelineTracks = z.infer<typeof TimelineTracksSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
