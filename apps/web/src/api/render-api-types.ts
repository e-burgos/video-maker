export const ASSET_ROLES = ['aroll', 'broll', 'image', 'audio', 'voice', 'logo'] as const;

export type AssetRole = (typeof ASSET_ROLES)[number];

export type AssetSource = 'catalog' | 'raw-scan';

export type ServiceStatus = 'ok' | 'degraded';

export type EngineModuleHealth = {
  name: string;
  loaded: boolean;
};

export type MediaBinaryHealth = {
  name: string;
  envVar: string;
  resolved: boolean;
};

export type ServiceCapabilities = {
  renderPipeline: boolean;
  assetStore: boolean;
  jobQueue: boolean;
  montageQueue: boolean;
  storyboardQueue: boolean;
  voiceQueue: boolean;
  producer: boolean;
};

export type ServiceJobCounters = {
  running: number;
  queued: number;
};

export type ServiceHealth = {
  status: ServiceStatus;
  service: string;
  cycle: number;
  time: string;
  engine: EngineModuleHealth[];
  binaries: MediaBinaryHealth[];
  capabilities: ServiceCapabilities;
  jobs: ServiceJobCounters;
};

export type ProjectLayout = {
  raw: boolean;
  catalog: boolean;
  timeline: boolean;
  edl: boolean;
  out: boolean;
};

export type ProjectSummary = {
  slug: string;
  layout: ProjectLayout;
};

export type AssetCounts = Record<AssetRole, number>;

export type ProjectDetail = ProjectSummary & {
  assetSource: AssetSource;
  assetCounts: AssetCounts;
};

export type AssetFingerprint = {
  sizeBytes: number;
  modifiedAtMs: number;
};

export type MediaKind = 'video' | 'image' | 'audio';

export type ProbedAudio = {
  sampleRate: number;
  channels: number;
  codec: string;
};

export type ProbedMedia = {
  id: string;
  kind: MediaKind;
  path: string;
  durationMs: number;
  fps?: number;
  width?: number;
  height?: number;
  rotation?: number;
  hasAudio?: boolean;
  audio?: ProbedAudio;
  videoCodec?: string;
  probedAt: string;
};

export type AssetListEntry = {
  path: string;
  role: AssetRole;
  fingerprint: AssetFingerprint;
  media: ProbedMedia | null;
};

export type AssetProbeFailure = {
  path: string;
  errorCode: string;
};

export const TIMELINE_CLIP_TRACKS = ['aroll', 'broll', 'voice', 'music'] as const;

export type TimelineClipTrack = (typeof TIMELINE_CLIP_TRACKS)[number];

export type TimelineAssetReference =
  | { kind: 'asset' }
  | { kind: 'clip'; track: TimelineClipTrack; clipId: string }
  | { kind: 'logo' };

export type DeletedAsset = {
  path: string;
  role: AssetRole;
  catalogEntryRemoved: boolean;
  removedArtifacts: string[];
};

export type AssetDeletion = {
  slug: string;
  deleted: DeletedAsset;
  timelineReferences: TimelineAssetReference[];
};

export type AssetListing = {
  slug: string;
  source: AssetSource;
  assets: AssetListEntry[];
  probeFailures: AssetProbeFailure[];
};

export type RenderApiErrorPayload = {
  code: string;
  stage: string | null;
  message: string;
  resource?: string;
  expected?: string;
  hint?: string;
  assetPersisted?: boolean;
  catalogUpdated?: boolean;
};

export const RENDER_JOB_STATES = [
  'queued',
  'running',
  'canceling',
  'succeeded',
  'failed',
  'canceled',
] as const;

export type RenderJobState = (typeof RENDER_JOB_STATES)[number];

export const TERMINAL_RENDER_JOB_STATES = ['succeeded', 'failed', 'canceled'] as const;

export const RENDER_PIPELINE_STAGES = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export const JOB_KINDS = ['render', 'montage', 'storyboard', 'voice'] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export const MONTAGE_PRESETS = ['software-demo', 'hardware', 'recipe', 'educational'] as const;

export type MontagePresetName = (typeof MONTAGE_PRESETS)[number];

export const MONTAGE_STAGES = ['discover', 'probe', 'transcribe', 'plan'] as const;

export type MontageStage = (typeof MONTAGE_STAGES)[number];

export const STORYBOARD_STAGES = ['collect', 'propose', 'persist'] as const;

export type StoryboardStage = (typeof STORYBOARD_STAGES)[number];

export const STORYBOARD_SOURCES = ['brief', 'script'] as const;

export type StoryboardJobSource = (typeof STORYBOARD_SOURCES)[number];

export const VOICE_STAGES = ['synthesize', 'transcribe', 'persist'] as const;

export type VoiceStage = (typeof VOICE_STAGES)[number];

export const VOICE_TRACK_SOURCES = ['generated', 'uploaded'] as const;

export type VoiceTrackSource = (typeof VOICE_TRACK_SOURCES)[number];

export type RenderJobProgress = {
  stage: RenderPipelineStage;
  renderedFrames: number | null;
  totalFrames: number | null;
  percent: number | null;
};

export type RenderDeliverableReport = {
  resource: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

export type RenderIntermediatesReport = {
  mutedVideoResource: string;
  masterAudioResource: string;
};

export type RenderLoudnessReport = {
  withinTolerance: boolean;
  integratedLufs: number;
  truePeakDbtp: number;
  integratedDeltaLu: number;
  truePeakDeltaDb: number;
};

export type RenderPipelineReport = {
  renderId: string;
  startedAt: string;
  finishedAt: string;
  deliverable: RenderDeliverableReport;
  intermediates: RenderIntermediatesReport;
  loudness: RenderLoudnessReport;
};

export type MontageJobProgress = {
  stage: MontageStage;
  processedAssets: number | null;
  totalAssets: number | null;
  percent: number | null;
};

export type MontageJobReport = {
  catalogPath: string;
  timelinePath: string;
  editDecisionListPath: string;
  preset: MontagePresetName;
  seed: number;
};

export type RenderJob = {
  id: string;
  kind: 'render';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
  error: RenderApiErrorPayload | null;
};

export type MontageJob = {
  id: string;
  kind: 'montage';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: MontageJobProgress | null;
  report: MontageJobReport | null;
  error: RenderApiErrorPayload | null;
};

export type StoryboardJobProgress = {
  stage: StoryboardStage;
  percent: number | null;
};

export type StoryboardJobUsage = {
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  model: string | null;
};

export type StoryboardJobReport = {
  storyboardPath: string;
  storyboardId: string;
  source: StoryboardJobSource;
  language: string;
  sceneCount: number;
  usage: StoryboardJobUsage;
};

export type StoryboardJob = {
  id: string;
  kind: 'storyboard';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: StoryboardJobProgress | null;
  report: StoryboardJobReport | null;
  error: RenderApiErrorPayload | null;
};

export type VoiceJobProgress = {
  stage: VoiceStage;
  processedScenes: number | null;
  totalScenes: number | null;
  percent: number | null;
};

export type VoiceJobSceneReport = {
  sceneId: string;
  path: string;
  wordsPath: string;
  durationMs: number;
  source: VoiceTrackSource;
};

export const VOICE_JOB_SOURCES = ['storyboard', 'script'] as const;

export type VoiceJobSource = (typeof VOICE_JOB_SOURCES)[number];

export type VoiceJobTrackReport = {
  path: string;
  wordsPath: string;
  durationMs: number;
  lineCount: number;
  gapMs: number;
};

export type VoiceJobReport = {
  source: VoiceJobSource;
  manifestPath: string;
  storyboardId: string | null;
  voiceId: string;
  language: string;
  scenes: VoiceJobSceneReport[];
  track: VoiceJobTrackReport | null;
};

export type VoiceJob = {
  id: string;
  kind: 'voice';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: VoiceJobProgress | null;
  report: VoiceJobReport | null;
  error: RenderApiErrorPayload | null;
};

export type Job = RenderJob | MontageJob | StoryboardJob | VoiceJob;

export type RenderJobSummary = {
  id: string;
  kind: JobKind;
  state: RenderJobState;
  stage: RenderPipelineStage | MontageStage | StoryboardStage | VoiceStage | null;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type RenderJobListing = {
  slug: string;
  jobs: RenderJobSummary[];
};

export type TimelineWriteResult = {
  slug: string;
  path: string;
};

export type StoryboardWriteResult = {
  slug: string;
  path: string;
};

export const VOICE_QUALITIES = ['x_low', 'low', 'medium', 'high'] as const;

export type VoiceQuality = (typeof VOICE_QUALITIES)[number];

export type VoiceLanguage = {
  code: string;
  region: string | null;
};

export type VoiceModel = {
  id: string;
  fileName: string;
  isDefault: boolean;
  language: VoiceLanguage;
  quality: VoiceQuality | null;
  label: string;
  description: string;
  previewUrl: string;
};

export type VoiceListing = {
  voices: VoiceModel[];
};

export type VoiceTrack = {
  sceneId: string;
  index: number;
  source: VoiceTrackSource;
  path: string;
  wordsPath: string;
  durationMs: number;
  sampleRate: number;
  voiceId: string | null;
  narrationHash: string;
  updatedAt: string;
};

export type VoiceManifest = {
  schemaVersion: number;
  storyboardId: string;
  language: string;
  tracks: VoiceTrack[];
};

export type VoiceSceneStatus = {
  sceneId: string;
  index: number;
  source: VoiceTrackSource;
  stale: boolean | null;
};

export type VoiceDocument = {
  slug: string;
  manifest: VoiceManifest;
  scenes: VoiceSceneStatus[];
};

export type VoiceSceneWriteResult = {
  slug: string;
  path: string;
  track: VoiceTrack;
};

export const PRODUCER_MESSAGE_ROLES = ['user', 'assistant'] as const;

export type ProducerMessageRole = (typeof PRODUCER_MESSAGE_ROLES)[number];

export type ProducerMessage = {
  id: string;
  role: ProducerMessageRole;
  text: string;
  createdAt: string;
  suggestions?: string[];
  turnId?: string;
  model?: string;
};

export type ProducerModelOption = {
  id: string;
  label: string;
  description: string;
};

export type ProducerModelCatalog = {
  default: string;
  allowed: ProducerModelOption[];
};

export type ProducerSession = {
  sessionId: string;
  model: string;
  createdAt: string;
  lastTurnAt: string;
};

export const PRODUCER_TURN_STATUSES = ['running', 'succeeded', 'failed', 'canceled'] as const;

export type ProducerTurnStatus = (typeof PRODUCER_TURN_STATUSES)[number];

export const TERMINAL_PRODUCER_TURN_STATUSES = ['succeeded', 'failed', 'canceled'] as const;

export const PRODUCER_EVENT_TYPES = ['text', 'tool', 'status'] as const;

export type ProducerEventType = (typeof PRODUCER_EVENT_TYPES)[number];

export type ProducerTextEvent = {
  type: 'text';
  text: string;
};

export type ProducerToolEvent = {
  type: 'tool';
  name: string;
  summary: string;
};

export type ProducerStatusEvent = {
  type: 'status';
  status: string;
};

export type ProducerEvent = ProducerTextEvent | ProducerToolEvent | ProducerStatusEvent;

export type ProducerTurn = {
  turnId: string;
  slug: string;
  status: ProducerTurnStatus;
  model: string;
  startedAt: string;
  finishedAt: string | null;
  events: ProducerEvent[];
  assistantMessage: string | null;
  suggestions: string[];
  error: RenderApiErrorPayload | null;
};

export type ProducerConversation = {
  slug: string;
  messages: ProducerMessage[];
  session: ProducerSession | null;
  activeTurn: ProducerTurn | null;
  models: ProducerModelCatalog;
};

export type ProducerTurnAccepted = {
  slug: string;
  turnId: string;
  startedAt: string;
  status: 'running';
};
