import { z } from 'zod';

import {
  AudioClipSchema,
  AudioMixPlanSchema,
  CaptionStyleSchema as TimelineCaptionStyleSchema,
  LogoOverlaySchema,
  SafeZoneSchema,
  TimelineBumpersSchema,
  TimelineSchema,
} from '@video-maker/timeline-core';

import type { StudioToolName } from './tool-names';
import { STUDIO_TOOL_ERROR_CODES } from './tool-errors';

const ABSOLUTE_PATH_PATTERN = /^([a-zA-Z]:)?[/\\]/;

export const ProjectRelativePathSchema = z
  .string()
  .min(1, 'path must not be empty')
  .refine((value) => value.trim().length > 0, 'path must not be blank')
  .refine((value) => !value.includes('\\'), 'path must use forward slashes only')
  .refine((value) => !ABSOLUTE_PATH_PATTERN.test(value), 'path must be relative to the project root')
  .refine((value) => !value.split('/').includes('..'), 'path must not contain ".." segments');

export const MIN_EXTRACT_FRAMES_AT_SECONDS = 1;
export const MAX_EXTRACT_FRAMES_AT_SECONDS = 12;
export const MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS = 1;
export const MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS = 600;
export const MIN_SEARCH_FREE_MUSIC_RESULTS = 1;
export const MAX_SEARCH_FREE_MUSIC_RESULTS = 10;
export const MIN_SEARCH_FREE_MEDIA_RESULTS = 1;
export const MAX_SEARCH_FREE_MEDIA_RESULTS = 10;
export const MIN_VIEW_IMAGES_PATHS = 1;
export const MAX_VIEW_IMAGES_PATHS = 6;

export const FREE_MEDIA_KINDS = ['video', 'image'] as const;
export type FreeMediaKind = (typeof FREE_MEDIA_KINDS)[number];
export const FreeMediaKindSchema = z.enum(FREE_MEDIA_KINDS);

export const FREE_MEDIA_SOURCES = ['commons', 'nasa'] as const;
export type FreeMediaSource = (typeof FREE_MEDIA_SOURCES)[number];
export const FreeMediaSourceSchema = z.enum(FREE_MEDIA_SOURCES);

export const STUDIO_JOB_KINDS = ['render', 'montage', 'storyboard', 'voice', 'photo-aroll'] as const;
export type StudioJobKind = (typeof STUDIO_JOB_KINDS)[number];
export const StudioJobKindSchema = z.enum(STUDIO_JOB_KINDS);

export const STUDIO_JOB_STATUSES = [
  'queued',
  'running',
  'canceling',
  'succeeded',
  'failed',
  'canceled',
] as const;
export type StudioJobStatus = (typeof STUDIO_JOB_STATUSES)[number];
export const StudioJobStatusSchema = z.enum(STUDIO_JOB_STATUSES);

export const StudioToolErrorSchema = z.strictObject({
  code: z.enum(STUDIO_TOOL_ERROR_CODES),
  hint: z.string(),
});

export const RenderApiJobErrorSchema = z.looseObject({
  code: z.string().min(1),
  stage: z.string().nullable(),
  message: z.string(),
  resource: z.string().optional(),
  expected: z.string().optional(),
  hint: z.string().optional(),
  assetPersisted: z.boolean().optional(),
  catalogUpdated: z.boolean().optional(),
});

const MONTAGE_PRESET_NAMES = ['software-demo', 'hardware', 'recipe', 'educational'] as const;
const MontagePresetNameSchema = z.enum(MONTAGE_PRESET_NAMES);

const OUTPUT_PRESETS = ['reels-9x16', 'tiktok-9x16', 'shorts-9x16', 'youtube-16x9'] as const;
const OutputPresetSchema = z.enum(OUTPUT_PRESETS);

const MONTAGE_LOGO_MODES = ['auto', 'off'] as const;
const MontageLogoModeSchema = z.enum(MONTAGE_LOGO_MODES);

const MONTAGE_VOICE_SOURCES = ['aroll', 'script'] as const;
const MontageVoiceSourceSchema = z.enum(MONTAGE_VOICE_SOURCES);

const CAPTION_STYLES = ['bold-impact', 'clean-sans', 'outline-pop', 'subtle-lower', 'off'] as const;
const CaptionStyleSchema = z.enum(CAPTION_STYLES);

export const DEFAULT_PHOTO_AROLL_FPS = 30;

const StartRenderJobSchema = z.strictObject({
  kind: z.literal('render'),
});

const StartMontageJobSchema = z
  .strictObject({
    kind: z.literal('montage'),
    preset: MontagePresetNameSchema.optional(),
    seed: z.number().int().nonnegative().optional(),
    overwrite: z.boolean().optional(),
    scriptPath: ProjectRelativePathSchema.optional(),
    scriptText: z.string().min(1).optional(),
    logo: MontageLogoModeSchema.optional(),
    format: OutputPresetSchema.optional(),
    voice: MontageVoiceSourceSchema.optional(),
    captionStyle: CaptionStyleSchema.optional(),
  })
  .refine((value) => value.scriptPath === undefined || value.scriptText === undefined, {
    message: 'at most one of scriptPath or scriptText',
    path: ['scriptText'],
  });

const StartStoryboardJobSchema = z
  .strictObject({
    kind: z.literal('storyboard'),
    brief: z.string().min(1).optional(),
    scriptText: z.string().min(1).optional(),
    overwrite: z.boolean().optional(),
  })
  .refine((value) => (value.brief === undefined) !== (value.scriptText === undefined), {
    message: 'exactly one of brief or scriptText',
    path: ['scriptText'],
  });

const StartVoiceJobSchema = z
  .strictObject({
    kind: z.literal('voice'),
    voice: z.string().min(1).optional(),
    sceneIds: z.array(z.string().min(1)).min(1).optional(),
    scriptText: z.string().min(1).optional(),
    scriptPath: ProjectRelativePathSchema.optional(),
    gapMs: z.number().int().nonnegative().optional(),
    overwrite: z.boolean().optional(),
  })
  .refine((value) => value.scriptText === undefined || value.scriptPath === undefined, {
    message: 'at most one of scriptText or scriptPath',
    path: ['scriptPath'],
  })
  .refine(
    (value) => {
      const isScriptMode = value.scriptText !== undefined || value.scriptPath !== undefined;
      return !isScriptMode || value.sceneIds === undefined;
    },
    { message: 'sceneIds only with the storyboard input, never with a script', path: ['sceneIds'] },
  )
  .refine(
    (value) => {
      const isScriptMode = value.scriptText !== undefined || value.scriptPath !== undefined;
      return isScriptMode || value.gapMs === undefined;
    },
    { message: 'gapMs only with scriptText or scriptPath', path: ['gapMs'] },
  );

const StartPhotoArollJobSchema = z.strictObject({
  kind: z.literal('photo-aroll'),
  photos: z.array(ProjectRelativePathSchema).min(1),
  output: z.string().min(1),
  fps: z.literal(DEFAULT_PHOTO_AROLL_FPS).optional(),
});

export const StartJobInputSchema = z.discriminatedUnion('kind', [
  StartRenderJobSchema,
  StartMontageJobSchema,
  StartStoryboardJobSchema,
  StartVoiceJobSchema,
  StartPhotoArollJobSchema,
]);

export type StartJobInput = z.infer<typeof StartJobInputSchema>;

const StartJobToolInputSchema = z.strictObject({
  job: StartJobInputSchema,
});

const StartJobOutputSchema = z.strictObject({
  jobId: z.string(),
  kind: StudioJobKindSchema,
  status: StudioJobStatusSchema,
});

const GetProjectOverviewInputSchema = z.strictObject({});

const GetProjectOverviewOutputSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  assets: z.array(
    z.strictObject({
      path: ProjectRelativePathSchema,
      role: z.string(),
      durationMs: z.number().int().nonnegative().nullable(),
    }),
  ),
  pendingAssets: z.array(
    z.strictObject({
      assetId: z.string(),
      fileName: z.string(),
      proposedRole: z.string(),
      proposalReason: z.string(),
    }),
  ),
  hasTimeline: z.boolean(),
  script: z.enum(['none', 'plain', 'timed']),
  recentJobs: z.array(
    z.strictObject({
      jobId: z.string(),
      kind: StudioJobKindSchema,
      status: StudioJobStatusSchema,
    }),
  ),
});

const ProbeMediaInputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
});

const ProbeMediaOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  durationMs: z.number().int().nonnegative(),
  video: z
    .strictObject({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      fps: z.number().positive(),
      frames: z.number().int().nonnegative(),
      codec: z.string(),
      hasAlpha: z.boolean(),
    })
    .nullable(),
  audio: z
    .strictObject({
      channels: z.number().int().positive(),
      sampleRate: z.number().int().positive(),
      codec: z.string(),
    })
    .nullable(),
});

const ExtractFramesInputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  atSeconds: z
    .array(z.number().nonnegative())
    .min(MIN_EXTRACT_FRAMES_AT_SECONDS)
    .max(MAX_EXTRACT_FRAMES_AT_SECONDS),
});

const ExtractFramesOutputSchema = z.strictObject({
  frames: z.array(
    z.strictObject({
      atSeconds: z.number().nonnegative(),
      path: ProjectRelativePathSchema,
    }),
  ),
});

const ListVoicesInputSchema = z.strictObject({});

const ListVoicesOutputSchema = z.strictObject({
  voices: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      language: z.string(),
      quality: z.string(),
      description: z.string(),
    }),
  ),
  defaultVoiceId: z.string(),
});

const ReadProjectTextInputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
});

const ReadProjectTextOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  content: z.string(),
});

const WriteProjectTextInputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  content: z.string(),
});

const WriteProjectTextOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  bytes: z.number().int().nonnegative(),
});

const CopyAssetInputSchema = z.strictObject({
  from: ProjectRelativePathSchema,
  role: z.string().min(1),
  filename: z.string().min(1),
});

const CopyAssetOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
});

const WaitForJobInputSchema = z.strictObject({
  jobId: z.string(),
  timeoutSeconds: z
    .number()
    .int()
    .min(MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS)
    .max(MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS),
});

const WaitForJobOutputSchema = z.strictObject({
  jobId: z.string(),
  kind: StudioJobKindSchema,
  status: StudioJobStatusSchema,
  progress: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: RenderApiJobErrorSchema.nullable(),
});

const CancelJobInputSchema = z.strictObject({
  jobId: z.string(),
});

const CancelJobOutputSchema = z.strictObject({
  jobId: z.string(),
  status: StudioJobStatusSchema,
});

const GetTimelineInputSchema = z.strictObject({});

const GetTimelineOutputSchema = z.strictObject({
  timeline: TimelineSchema,
});

const PutTimelineInputSchema = z.strictObject({
  timeline: z.union([TimelineSchema, z.string().min(1)]),
  editCaptions: z.boolean().optional(),
});

const PutTimelineOutputSchema = z.strictObject({
  saved: z.literal(true),
});

export const PATCH_TIMELINE_SECTIONS = ['logo', 'bumpers', 'audioMix', 'captionStyle', 'safeZone', 'music'] as const;
export type PatchTimelineSection = (typeof PATCH_TIMELINE_SECTIONS)[number];
const PatchTimelineSectionSchema = z.enum(PATCH_TIMELINE_SECTIONS);

const PatchTimelineInputSchema = z
  .strictObject({
    logo: LogoOverlaySchema.nullable().optional(),
    bumpers: TimelineBumpersSchema.nullable().optional(),
    audioMix: AudioMixPlanSchema.optional(),
    captionStyle: TimelineCaptionStyleSchema.nullable().optional(),
    safeZone: SafeZoneSchema.nullable().optional(),
    music: z.array(AudioClipSchema).optional(),
  })
  .refine(
    (value) => PATCH_TIMELINE_SECTIONS.some((section) => value[section] !== undefined),
    { message: 'patch_timeline needs at least one section to replace' },
  );

export type PatchTimelineInput = z.infer<typeof PatchTimelineInputSchema>;

const PatchTimelineOutputSchema = z.strictObject({
  changed: z.array(PatchTimelineSectionSchema).min(1),
  summary: z.string(),
});

const SearchFreeMusicInputSchema = z.strictObject({
  mood: z.string().min(1),
  maxResults: z.number().int().min(MIN_SEARCH_FREE_MUSIC_RESULTS).max(MAX_SEARCH_FREE_MUSIC_RESULTS),
});

const SearchFreeMusicOutputSchema = z.strictObject({
  results: z.array(
    z.strictObject({
      resultId: z.string(),
      title: z.string(),
      durationMs: z.number().int().nonnegative(),
      license: z.string(),
      author: z.string(),
      pageUrl: z.string(),
    }),
  ),
});

const ImportMusicInputSchema = z.strictObject({
  resultId: z.string().min(1),
});

const ImportMusicOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  credit: z.record(z.string(), z.unknown()),
});

const SearchFreeMediaInputSchema = z.strictObject({
  query: z.string().min(1),
  kind: FreeMediaKindSchema,
  maxResults: z.number().int().min(MIN_SEARCH_FREE_MEDIA_RESULTS).max(MAX_SEARCH_FREE_MEDIA_RESULTS),
});

const SearchFreeMediaOutputSchema = z.strictObject({
  results: z.array(
    z.strictObject({
      resultId: z.string(),
      source: FreeMediaSourceSchema,
      kind: FreeMediaKindSchema,
      title: z.string(),
      license: z.string(),
      author: z.string(),
      pageUrl: z.string(),
      durationMs: z.number().int().nonnegative().nullable(),
      width: z.number().int().positive().nullable(),
      height: z.number().int().positive().nullable(),
    }),
  ),
});

const ImportMediaInputSchema = z.strictObject({
  resultId: z.string().min(1),
});

const ImportMediaOutputSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  credit: z.record(z.string(), z.unknown()),
});

const ViewImagesInputSchema = z.strictObject({
  paths: z.array(ProjectRelativePathSchema).min(MIN_VIEW_IMAGES_PATHS).max(MAX_VIEW_IMAGES_PATHS),
});

const ViewImagesOutputSchema = z.strictObject({
  previews: z.array(
    z.strictObject({
      path: ProjectRelativePathSchema,
      previewPath: ProjectRelativePathSchema,
    }),
  ),
});

export interface StudioToolDefinition<Input extends z.ZodTypeAny = z.ZodTypeAny, Output extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly description: string;
  readonly input: Input;
  readonly output: Output;
}

export const STUDIO_TOOLS: Readonly<Record<StudioToolName, StudioToolDefinition>> = {
  get_project_overview: {
    description:
      'Get a snapshot of the current project: its assets, whether a timeline or script already exists, and its most recent jobs. Call this first to orient yourself before doing anything else.',
    input: GetProjectOverviewInputSchema,
    output: GetProjectOverviewOutputSchema,
  },
  probe_media: {
    description:
      'Inspect a media file already inside the project (duration, video and audio streams) without running ffprobe yourself. Use it to measure raw material before editing.',
    input: ProbeMediaInputSchema,
    output: ProbeMediaOutputSchema,
  },
  extract_frames: {
    description:
      'Extract up to 12 still frames from a video at the given timestamps and get them back as images plus their saved paths. Use it to look at footage instead of running ffmpeg.',
    input: ExtractFramesInputSchema,
    output: ExtractFramesOutputSchema,
  },
  list_voices: {
    description: 'List the text-to-speech voices available for the voice job, including the default one.',
    input: ListVoicesInputSchema,
    output: ListVoicesOutputSchema,
  },
  read_project_text: {
    description:
      'Read a small text, markdown, JSON or SRT file from inside the project (under work/), up to 256 KB.',
    input: ReadProjectTextInputSchema,
    output: ReadProjectTextOutputSchema,
  },
  write_project_text: {
    description:
      'Write a text file inside the project, only under work/producer/ or work/credits.json. Parent directories are created automatically.',
    input: WriteProjectTextInputSchema,
    output: WriteProjectTextOutputSchema,
  },
  copy_asset: {
    description:
      'Copy an existing file inside the project into raw/<role>/<filename>. Fails if the destination already exists and never deletes the source.',
    input: CopyAssetInputSchema,
    output: CopyAssetOutputSchema,
  },
  start_job: {
    description:
      'Start an asynchronous render engine job and get back its id and initial status. Poll it with ' +
      'wait_for_job. Pass the job under "job"; its "kind" — render, montage, storyboard, voice or ' +
      'photo-aroll — picks the shape of the rest of the object.',
    input: StartJobToolInputSchema,
    output: StartJobOutputSchema,
  },
  wait_for_job: {
    description:
      'Wait for a job to finish, up to timeoutSeconds. Returns early on completion, or with status "running" once the timeout elapses.',
    input: WaitForJobInputSchema,
    output: WaitForJobOutputSchema,
  },
  cancel_job: {
    description: 'Cancel a running or queued job.',
    input: CancelJobInputSchema,
    output: CancelJobOutputSchema,
  },
  get_timeline: {
    description: 'Get the project timeline as it is currently persisted.',
    input: GetTimelineInputSchema,
    output: GetTimelineOutputSchema,
  },
  put_timeline: {
    description:
      'Replace the project timeline in full with a new, already valid timeline. Rejects a timeline whose ' +
      'caption words differ from what is saved — for example lost accents — unless editCaptions is true ' +
      'because the user explicitly asked to change the caption text. For a change that never touches the ' +
      'words (logo, intro/outro plates, music level, caption style, safe zone) use patch_timeline instead. ' +
      'Accepts the timeline as an object, or as a JSON string that parses to one.',
    input: PutTimelineInputSchema,
    output: PutTimelineOutputSchema,
  },
  patch_timeline: {
    description:
      'Replace only the given sections of the already saved timeline — logo, bumpers, audioMix, ' +
      'captionStyle, safeZone and/or the music track — without touching captions, voice or any other word. ' +
      'Reads the current timeline, replaces just those sections, validates the result and saves it. Use this ' +
      'for a logo, an intro/outro plate, the music level or the caption style instead of put_timeline, which ' +
      'forces you to re-send every caption word. Fails if the project has no timeline yet.',
    input: PatchTimelineInputSchema,
    output: PatchTimelineOutputSchema,
  },
  search_free_music: {
    description:
      'Search Wikimedia Commons for freely licensed music matching a mood, up to maxResults results. Use the returned resultId with import_music.',
    input: SearchFreeMusicInputSchema,
    output: SearchFreeMusicOutputSchema,
  },
  import_music: {
    description:
      'Download a previously searched music result into raw/audio/ and record its credit in work/credits.json.',
    input: ImportMusicInputSchema,
    output: ImportMusicOutputSchema,
  },
  search_free_media: {
    description:
      'Search Wikimedia Commons and the NASA Image and Video Library for freely licensed B-roll video or photos matching a query, up to maxResults results. Use the returned resultId with import_media.',
    input: SearchFreeMediaInputSchema,
    output: SearchFreeMediaOutputSchema,
  },
  import_media: {
    description:
      'Download a previously searched free media result into raw/broll/ (video) or raw/images/ (image) and record its credit in work/credits.json.',
    input: ImportMediaInputSchema,
    output: ImportMediaOutputSchema,
  },
  view_images: {
    description:
      'Look at up to 6 photos already in the project and get them back as images. Use this to see a photo instead of extract_frames, which only works on video.',
    input: ViewImagesInputSchema,
    output: ViewImagesOutputSchema,
  },
};
