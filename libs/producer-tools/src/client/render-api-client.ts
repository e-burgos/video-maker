import type { MaterialReview, ReferenceBrief, SceneFrame, SceneVisualReview, VisualReview } from '@video-maker/timeline-core';

export type RenderApiProjectMode = 'footage' | 'motion';

export interface RenderApiMotionBrand {
  readonly id: string;
  readonly name: string;
  readonly source?: 'built-in' | 'user';
  readonly formats: readonly string[];
  readonly music: readonly {
    readonly id: string;
    readonly mood: string;
    readonly bpm: number;
    readonly hasDrop: boolean;
  }[];
}

export interface RenderApiProjectDetail {
  readonly slug: string;
  readonly mode?: RenderApiProjectMode;
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

export interface RenderApiJobError {
  readonly code: string;
  readonly stage: string | null;
  readonly message: string;
  readonly resource?: string;
  readonly expected?: string;
  readonly hint?: string;
  readonly assetPersisted?: boolean;
  readonly catalogUpdated?: boolean;
}

export interface RenderApiJob {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly progress: unknown;
  readonly report: unknown;
  readonly error: RenderApiJobError | null;
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

export type RenderApiFreeMediaKind = 'video' | 'image';
export type RenderApiFreeMediaSource = 'commons' | 'nasa';

export interface RenderApiFreeMediaResult {
  readonly resultId: string;
  readonly source: RenderApiFreeMediaSource;
  readonly kind: RenderApiFreeMediaKind;
  readonly title: string;
  readonly license: string;
  readonly author: string;
  readonly pageUrl: string;
  readonly durationMs: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface RenderApiImagePreview {
  readonly path: string;
  readonly previewPath: string;
}

export interface RenderApiRenderReview {
  readonly file: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly createdAt: string;
  readonly metrics: Readonly<Record<string, number | null>>;
  readonly findings: readonly {
    readonly id: string;
    readonly check: string;
    readonly severity: 'critical' | 'suggestion' | 'nitpick';
    readonly message: string;
    readonly timeRange?: { readonly startSec: number; readonly endSec: number };
    readonly proposedFix?: string;
  }[];
  readonly sceneFrames?: readonly SceneFrame[];
  readonly visualReview?: VisualReview;
}

export interface RenderApiReferenceSummary {
  readonly name: string;
  readonly file: string;
  readonly briefFile: string;
  readonly durationSec: number;
  readonly scenes: number;
  readonly cutsPerMinute: number;
  readonly hasVoice: boolean;
  readonly summary: string;
  readonly createdAt: string;
}

export interface RenderApiProposalState {
  readonly status: 'pending' | 'approved';
  readonly approvedConceptId?: string;
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

  searchFreeMedia(
    query: string,
    kind: RenderApiFreeMediaKind,
    maxResults: number,
  ): Promise<readonly RenderApiFreeMediaResult[]>;
  importMedia(resultId: string): Promise<{ readonly path: string; readonly credit: Readonly<Record<string, unknown>> }>;
  previewImages(paths: readonly string[]): Promise<readonly RenderApiImagePreview[]>;

  getRenderReview(file: string | undefined): Promise<RenderApiRenderReview | null>;
  putVisualReview(file: string, scenes: readonly SceneVisualReview[]): Promise<RenderApiRenderReview>;

  listReferences(): Promise<readonly RenderApiReferenceSummary[]>;
  getReference(name: string): Promise<ReferenceBrief>;

  getProposalState(): Promise<RenderApiProposalState | null>;
  putProposal(draft: Readonly<Record<string, unknown>>): Promise<{ readonly concepts: number }>;

  getMaterialReview(): Promise<MaterialReview | null>;
  putMaterialReview(draft: Readonly<Record<string, unknown>>): Promise<MaterialReview>;

  listMotionBrands(): Promise<readonly RenderApiMotionBrand[]>;
  getMotionBrief(): Promise<Readonly<Record<string, unknown>>>;
  putMotionBrief(brief: Readonly<Record<string, unknown>>): Promise<void>;
  getMotionStoryboard(): Promise<Readonly<Record<string, unknown>>>;
  putMotionStoryboard(storyboard: Readonly<Record<string, unknown>>): Promise<void>;
}
