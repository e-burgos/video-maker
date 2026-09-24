export interface RenderApiProjectDetail {
  readonly slug: string;
  readonly layout: {
    readonly raw: boolean;
    readonly catalog: boolean;
    readonly timeline: boolean;
    readonly edl: boolean;
    readonly out: boolean;
  };
  readonly assetSource: 'catalog' | 'raw-scan';
  readonly assetCounts: Readonly<Record<string, number>>;
}

export interface RenderApiAssetEntry {
  readonly path: string;
  readonly role: string;
  readonly media: { readonly durationMs: number } | null;
}

export interface RenderApiPendingAsset {
  readonly id: string;
  readonly fileName: string;
  readonly proposedRole: string;
  readonly proposalReason: string;
}

export interface RenderApiJobSummary {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly createdAt: string;
}

export interface RenderApiJob {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly progress: unknown;
  readonly report: unknown;
  readonly error: { readonly code: string; readonly hint?: string } | null;
}

export interface RenderApiVoice {
  readonly id: string;
  readonly label: string;
  readonly language: { readonly code: string; readonly region: string | null };
  readonly quality: string | null;
  readonly description: string;
  readonly isDefault: boolean;
}

export interface RenderApiProbeResult {
  readonly path: string;
  readonly durationMs: number;
  readonly video: Readonly<Record<string, unknown>> | null;
  readonly audio: Readonly<Record<string, unknown>> | null;
}

export interface RenderApiExtractedFrame {
  readonly atSeconds: number;
  readonly path: string;
}

export interface RenderApiFileBytes {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface RenderApiMusicResult {
  readonly resultId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly license: string;
  readonly author: string;
  readonly pageUrl: string;
}

export interface RenderApiClient {
  getProjectDetail(): Promise<RenderApiProjectDetail>;
  listProjectAssets(): Promise<readonly RenderApiAssetEntry[]>;
  listPendingAssets(): Promise<readonly RenderApiPendingAsset[]>;
  listRecentJobs(limit: number): Promise<readonly RenderApiJobSummary[]>;
  readProducerScriptState(): Promise<'none' | 'plain' | 'timed'>;

  probeMedia(path: string): Promise<RenderApiProbeResult>;
  extractFrames(path: string, atSeconds: readonly number[]): Promise<readonly RenderApiExtractedFrame[]>;
  readFileBytes(path: string): Promise<RenderApiFileBytes>;

  readProjectText(path: string): Promise<{ readonly path: string; readonly content: string }>;
  writeProjectText(path: string, content: string): Promise<{ readonly path: string; readonly bytes: number }>;
  copyAsset(from: string, role: string, filename: string): Promise<{ readonly path: string }>;

  listVoices(): Promise<{ readonly voices: readonly RenderApiVoice[]; readonly defaultVoiceId: string }>;

  createJob(body: Readonly<Record<string, unknown>>): Promise<RenderApiJob>;
  getJob(jobId: string): Promise<RenderApiJob>;
  cancelJob(jobId: string): Promise<RenderApiJob>;

  getTimeline(): Promise<unknown>;
  putTimeline(timeline: unknown): Promise<void>;

  searchFreeMusic(mood: string, maxResults: number): Promise<readonly RenderApiMusicResult[]>;
  importMusic(resultId: string): Promise<{ readonly path: string; readonly credit: Readonly<Record<string, unknown>> }>;
}
