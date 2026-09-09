export const ASSET_ROLES = ['aroll', 'broll', 'image', 'audio'] as const;

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

export type RenderJob = {
  id: string;
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
  error: RenderApiErrorPayload | null;
};

export type RenderJobSummary = {
  id: string;
  state: RenderJobState;
  stage: RenderPipelineStage | null;
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
