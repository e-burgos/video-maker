import type { AssetRole, ScriptAlignmentCounts } from '@video-maker/auto-montage';

export interface AssetRoleCount {
  readonly role: AssetRole;
  readonly count: number;
}

export interface IngestTranscriptionFailureReport {
  readonly assetId: string;
  readonly failedStage: string;
}

export interface IngestReport {
  readonly kind: 'ingest';
  readonly catalogPath: string;
  readonly assetCounts: readonly AssetRoleCount[];
  readonly transcribedCount: number;
  readonly reusedTranscriptionCount: number;
  readonly probeFailurePaths: readonly string[];
  readonly transcriptionFailures: readonly IngestTranscriptionFailureReport[];
  readonly staleCatalogReplaced: boolean;
}

export interface PlanBrollRejectionReport {
  readonly conceptTerm: string;
  readonly startMs: number;
  readonly reason: string;
}

export interface PlanReport {
  readonly kind: 'plan';
  readonly timelinePath: string;
  readonly edlPath: string;
  readonly editedDurationMs: number;
  readonly transcriptionSource: string;
  readonly conceptTerms: readonly string[];
  readonly brollOverlayCount: number;
  readonly brollRejections: readonly PlanBrollRejectionReport[];
  readonly logoAssetId: string | null;
  readonly scriptAlignment: ScriptAlignmentCounts | null;
}

export interface RenderReport {
  readonly kind: 'render';
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export interface RunReport {
  readonly kind: 'run';
  readonly ingest: IngestReport;
  readonly plan: PlanReport;
  readonly render: RenderReport;
}

export type CliReport = IngestReport | PlanReport | RenderReport | RunReport;
