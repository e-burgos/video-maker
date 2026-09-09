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
