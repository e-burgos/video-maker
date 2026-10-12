import { z } from 'zod';

import {
  AudioClipSchema,
  AudioMixPlanSchema,
  CaptionStyleSchema as TimelineCaptionStyleSchema,
  LogoOverlaySchema,
  MaterialReviewDraftSchema,
  ProductionProposalDraftSchema,
  ReferenceBriefSchema,
  ReviewReportSchema,
  SafeZoneSchema,
  TimelineBumpersSchema,
  TimelineSchema,
  VisualReviewDraftSchema,
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

export const STUDIO_JOB_KINDS = ['render', 'montage', 'storyboard', 'voice', 'photo-aroll', 'motion', 'reference'] as const;
export type StudioJobKind = (typeof STUDIO_JOB_KINDS)[number];
export const StudioJobKindSchema = z.enum(STUDIO_JOB_KINDS);

export const STUDIO_BACKGROUND_JOB_KINDS = ['publish', 'review'] as const;
export const StudioListedJobKindSchema = z.enum([...STUDIO_JOB_KINDS, ...STUDIO_BACKGROUND_JOB_KINDS]);

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

const CaptionStyleSchema = TimelineCaptionStyleSchema;

export const DEFAULT_PHOTO_AROLL_FPS = 30;

export const MIN_SAMPLE_SECONDS = 8;
export const MAX_SAMPLE_SECONDS = 20;

const SampleSchema = z
  .strictObject({
    seconds: z.number().min(MIN_SAMPLE_SECONDS).max(MAX_SAMPLE_SECONDS),
  })
  .describe(
    'Render only the first N seconds (8 to 20) to out/<name>.sample.mp4 instead of the whole video. A sample is never blocked by the proposal approval, is not reviewed and can never be published.',
  );

const SkipProposalSchema = z
  .literal(true)
  .describe(
    'Only when the user explicitly asked, in this chat, to render without approving a proposal first. Never set it on your own.',
  );

const StartRenderJobSchema = z.strictObject({
  kind: z.literal('render'),
  sample: SampleSchema.optional(),
  skipProposal: SkipProposalSchema.optional(),
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
    musicMode: z
      .enum(['bed', 'segments'])
      .describe(
        "bed (default): the music runs under everything and ducks while someone speaks. segments: the music plays full in the intro, the outro and the voice-free gaps of 2 s or more, with 0.6 s fades, and drops to a very low floor while someone speaks",
      )
      .optional(),
    musicFloorDb: z
      .number()
      .min(-60)
      .max(-6)
      .describe('Only with musicMode segments: how many dB below the full music level it sits while someone speaks; default -30')
      .optional(),
  })
  .refine((value) => value.scriptPath === undefined || value.scriptText === undefined, {
    message: 'at most one of scriptPath or scriptText',
    path: ['scriptText'],
  })
  .refine((value) => value.musicFloorDb === undefined || value.musicMode === 'segments', {
    message: "musicFloorDb only with musicMode 'segments'",
    path: ['musicFloorDb'],
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

export const REFERENCE_FILE_PATTERN = /^raw\/reference\/[^/\\]+$/u;

const StartReferenceJobSchema = z.strictObject({
  kind: z.literal('reference'),
  file: z
    .string()
    .regex(REFERENCE_FILE_PATTERN, 'file must be a video directly under raw/reference/, for example raw/reference/modelo.mp4'),
});

export const MOTION_JOB_PHASES = ['storyboard', 'video', 'all'] as const;
export const MIN_MOTION_TAKES = 1;
export const MAX_MOTION_TAKES = 8;

const StartMotionJobSchema = z.strictObject({
  kind: z.literal('motion'),
  phase: z.enum(MOTION_JOB_PHASES).optional(),
  output: z.string().min(1).optional(),
  takes: z.number().int().min(MIN_MOTION_TAKES).max(MAX_MOTION_TAKES).optional(),
  overwrite: z.boolean().optional(),
  sample: SampleSchema.optional(),
  skipProposal: SkipProposalSchema.optional(),
});

export const StartJobInputSchema = z.discriminatedUnion('kind', [
  StartRenderJobSchema,
  StartMontageJobSchema,
  StartStoryboardJobSchema,
  StartVoiceJobSchema,
  StartPhotoArollJobSchema,
  StartMotionJobSchema,
  StartReferenceJobSchema,
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

export const PROJECT_MODES = ['footage', 'motion'] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];
export const ProjectModeSchema = z.enum(PROJECT_MODES);

const GetProjectOverviewOutputSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  mode: ProjectModeSchema,
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
      kind: StudioListedJobKindSchema,
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

const GetRenderReviewInputSchema = z.strictObject({
  file: z
    .string()
    .regex(/^out\/[^/\\]+\.mp4$/u, 'file must be an .mp4 directly under out/, for example out/video.mp4')
    .optional(),
});

export const VISUAL_REVIEW_STATES = ['not-applicable', 'pending', 'recorded'] as const;

const GetRenderReviewOutputSchema = ReviewReportSchema.pick({
  file: true,
  status: true,
  createdAt: true,
  metrics: true,
  findings: true,
  sceneFrames: true,
  visualReview: true,
}).extend({ visualReviewState: z.enum(VISUAL_REVIEW_STATES) });

const RecordVisualReviewInputSchema = VisualReviewDraftSchema.extend({
  file: z
    .string()
    .regex(/^out\/[^/\\]+\.mp4$/u, 'file must be an .mp4 directly under out/, for example out/video.mp4')
    .optional(),
});

const RecordVisualReviewOutputSchema = z.strictObject({
  saved: z.literal(true),
  file: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  scenes: z.number().int().min(1),
  flaggedScenes: z.number().int().min(0),
  criticalFindings: z.array(z.string()),
});

const GetReferenceBriefInputSchema = z.strictObject({
  name: z
    .string()
    .regex(/^[^/\\]+$/u, 'name is the reference file name without folder or extension, for example modelo')
    .optional(),
});

const ReferenceSummarySchema = z.strictObject({
  name: z.string(),
  file: z.string(),
  briefFile: z.string(),
  durationSec: z.number(),
  scenes: z.number().int(),
  cutsPerMinute: z.number(),
  hasVoice: z.boolean(),
  summary: z.string(),
  createdAt: z.string(),
});

const GetReferenceBriefOutputSchema = z.strictObject({
  references: z.array(ReferenceSummarySchema),
  brief: ReferenceBriefSchema.nullable(),
});

const ReviewMaterialInputSchema = MaterialReviewDraftSchema;

const ReviewMaterialOutputSchema = z.strictObject({
  saved: z.literal(true),
  items: z.number().int().min(0),
  fits: z.number().int().min(0),
  doubtful: z.number().int().min(0),
  unfit: z.number().int().min(0),
  gaps: z.number().int().min(0),
});

const ProposeProductionInputSchema = ProductionProposalDraftSchema;

const ProposeProductionOutputSchema = z.strictObject({
  saved: z.literal(true),
  status: z.literal('pending'),
  concepts: z.number().int().min(2).max(3),
});

const GetMotionBrandsInputSchema = z.strictObject({});

const GetMotionBrandsOutputSchema = z.strictObject({
  brands: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      source: z.enum(['built-in', 'user']).optional(),
      formats: z.array(z.string()),
      music: z.array(
        z.looseObject({
          id: z.string(),
          mood: z.string(),
          bpm: z.number(),
          hasDrop: z.boolean(),
        }),
      ),
    }),
  ),
});

const ReadMotionBriefInputSchema = z.strictObject({});

const ReadMotionBriefOutputSchema = z.strictObject({
  brief: z.record(z.string(), z.unknown()),
});

export const MotionBriefImageSchema = z.strictObject({
  file: z.string().min(1),
  caption: z.string(),
});

export const MotionBriefInputSchema = z.looseObject({
  version: z.literal(1),
  brand: z.string().min(1),
  title: z.string().optional(),
  format: z.string().optional(),
  beatSync: z.boolean().optional(),
  music: z.string().nullable().optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  script: z.string().min(1),
  images: z.array(MotionBriefImageSchema),
});

export type MotionBriefInput = z.infer<typeof MotionBriefInputSchema>;

const WriteMotionBriefInputSchema = z.strictObject({
  brief: MotionBriefInputSchema,
});

const WriteMotionBriefOutputSchema = z.strictObject({
  saved: z.literal(true),
});

const ReadMotionStoryboardInputSchema = z.strictObject({});

const ReadMotionStoryboardOutputSchema = z.strictObject({
  storyboard: z.record(z.string(), z.unknown()),
});

const WriteMotionStoryboardInputSchema = z.strictObject({
  storyboard: z.record(z.string(), z.unknown()),
});

const WriteMotionStoryboardOutputSchema = z.strictObject({
  saved: z.literal(true),
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
      'wait_for_job. Pass the job under "job"; its "kind" — render, montage, storyboard, voice, ' +
      'photo-aroll, motion or reference — picks the shape of the rest of the object. The reference kind ' +
      'takes the file raw/reference/<name>.mp4 and analyses it into a brief (get_reference_brief). The motion kind (only in a ' +
      'motion project) takes phase "storyboard", "video" or "all" (default), an optional output file ' +
      'name, takes 1 to 8 and overwrite. A full render (kind render, or motion with phase "video" or ' +
      '"all") is refused with PROPOSAL_NOT_APPROVED until the user approves a production proposal; ' +
      'render and motion also take sample {seconds: 8 to 20} for a short preview that is never blocked.',
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
      'Look at up to 6 photos already in the project and get them back as images. Use this to see a photo instead of extract_frames, which only works on video. ' +
      'Besides project paths (raw/images/x.png) it accepts brand:<key> to see a photo of the project brand (the keys come with their caption in the brand section of the project). ' +
      'The studio records every image you actually looked at: review_material only accepts those.',
    input: ViewImagesInputSchema,
    output: ViewImagesOutputSchema,
  },
  get_render_review: {
    description:
      'Read the automatic review of a finished render: its status (pass, warn, fail), the key metrics (master LUFS and true peak, voice/music margin) and the findings by severity (critical, suggestion, nitpick), each with its time range and the proposed fix. For a motion video it also lists `sceneFrames` (the frame of each scene to look at with view_images) and `visualReviewState` (pending until record_visual_review is called). Without `file` it returns the most recent review; with `file` (for example out/video.mp4) that render\'s. Fails with FILE_NOT_FOUND when the render was never reviewed.',
    input: GetRenderReviewInputSchema,
    output: GetRenderReviewOutputSchema,
  },
  record_visual_review: {
    description:
      'Record, with evidence, that you looked at every scene of a render. After get_render_review lists `sceneFrames` (one frame at the middle of each scene, with the voice text), look at them with view_images (up to 6 per call) and send `scenes`: one entry per sceneId with `shows` (what the frame really shows, one line), ' +
      '`matchesVoice`, `legible`, `couldBeOtherProduct` (booleans), `verdict` (ok or fix) and `note` (required when the scene is flagged: what to change). ' +
      'The studio refuses a review that misses a scene or covers a frame you did not view after the review was created (VISUAL_REVIEW_NOT_VIEWED). ' +
      'The critical finding visual-not-reviewed disappears; every scene marked fix, off the voice, illegible or ambiguous becomes a critical finding that blocks publishing until you fix it and re-render. Without `file` it uses the most recent review.',
    input: RecordVisualReviewInputSchema,
    output: RecordVisualReviewOutputSchema,
  },
  review_material: {
    description:
      'Record, with evidence, what the supplied material really is before you propose anything. `items` has one entry per image you looked at with view_images: ' +
      '`file` (the project path, for example raw/images/x.png, or brand:<key>), `source` (project or brand), `shows` (what the image actually shows, one line), ' +
      '`useFor` (the scene or role you would give it, optional), `verdict` (fits, doubtful or unfit) and `reason`. `gaps` lists what the idea needs and the material does not bring ' +
      '(`need`, `note`); send [] when there is none. The studio refuses an image you did not view (MATERIAL_NOT_VIEWED). ' +
      'propose_production fails with MATERIAL_NOT_REVIEWED until this review covers every project image.',
    input: ReviewMaterialInputSchema,
    output: ReviewMaterialOutputSchema,
  },
  propose_production: {
    description:
      'Save the production proposal the user must approve before the first full render: 2 or 3 concepts, ' +
      'each with an id, title, angle, output format preset, durationSec, scenes, delivery contract ' +
      '({kind: tutorial, motion or short, ...}), and optionally voiceId, musicMode and notes, plus the ' +
      'recommendedId. It first requires review_material to cover every project image (MATERIAL_NOT_REVIEWED) and the studio copies the unfit and doubtful images and the gaps into the proposal as warnings. ' +
      'It replaces any earlier proposal and leaves it pending: only the user approves it, ' +
      'in the studio. Time and cost estimates are computed by the studio, never by you.',
    input: ProposeProductionInputSchema,
    output: ProposeProductionOutputSchema,
  },
  get_reference_brief: {
    description:
      'Read what the studio learned from a reference video (a file under raw/reference/ that the user wants ' +
      'theirs to feel like). `references` always lists every analysed reference with its summary; without ' +
      '`name`, `brief` is null; with `name` (the file name without extension, for example modelo) `brief` is ' +
      'its full analysis: duration, format, the scenes with start, end and keyframe image, the pace (cuts per ' +
      'minute, mean and median scene length), the voice (transcript phrases with times, words per minute, ' +
      'speech ratio) and the audio (loudness, long silences). Fails with FILE_NOT_FOUND when that reference ' +
      'was never analysed: start_job {"kind":"reference","file":"raw/reference/<name>.mp4"} analyses it.',
    input: GetReferenceBriefInputSchema,
    output: GetReferenceBriefOutputSchema,
  },
  get_motion_brands: {
    description:
      'List the brands a motion video can use (built-in and user-made, each with its `source`), with the formats (16:9, 9:16) each supports and its music tracks (id, mood, bpm, hasDrop). Only for motion projects.',
    input: GetMotionBrandsInputSchema,
    output: GetMotionBrandsOutputSchema,
  },
  read_motion_brief: {
    description: 'Read the motion brief saved for this project. Fails with FILE_NOT_FOUND when none was written yet.',
    input: ReadMotionBriefInputSchema,
    output: ReadMotionBriefOutputSchema,
  },
  write_motion_brief: {
    description:
      'Save the motion brief (version 1, brand, script and one captioned entry per image in raw/images/) for ' +
      'this project, replacing the previous one. The studio validates it and answers with the offending field ' +
      'in the hint when it is invalid: fix that field and call again.',
    input: WriteMotionBriefInputSchema,
    output: WriteMotionBriefOutputSchema,
  },
  read_motion_storyboard: {
    description:
      'Read the motion storyboard (the scenes, each with its kind and voice line) that the storyboard phase produced. Fails with FILE_NOT_FOUND when it does not exist yet.',
    input: ReadMotionStoryboardInputSchema,
    output: ReadMotionStoryboardOutputSchema,
  },
  write_motion_storyboard: {
    description:
      'Save an edited motion storyboard (the whole JSON read with read_motion_storyboard, with your minimal changes), replacing the previous one. The studio validates it and answers with the offending field in the hint when it is invalid: fix that field and call again. Then re-render with start_job {"kind":"motion","phase":"video","overwrite":true}.',
    input: WriteMotionStoryboardInputSchema,
    output: WriteMotionStoryboardOutputSchema,
  },
};
