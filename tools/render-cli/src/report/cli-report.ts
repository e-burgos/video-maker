import type { AssetRole, ScriptAlignmentCounts, VoiceSource, VoiceTrackSummary } from '@video-maker/auto-montage';
import type { OutputFormat } from '@video-maker/timeline-core';

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
  readonly format: OutputFormat;
  readonly timelinePath: string;
  readonly edlPath: string;
  readonly editedDurationMs: number;
  readonly transcriptionSource: string;
  readonly voiceSource: VoiceSource;
  readonly voiceTrack: VoiceTrackSummary | null;
  readonly conceptTerms: readonly string[];
  readonly brollOverlayCount: number;
  readonly brollRejections: readonly PlanBrollRejectionReport[];
  readonly logoAssetId: string | null;
  readonly scriptAlignment: ScriptAlignmentCounts | null;
}

export interface RenderLoudnessReport {
  readonly withinTolerance: boolean;
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export interface RenderReport {
  readonly kind: 'render';
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
  readonly mutedVideoPath: string;
  readonly masterAudioPath: string;
  readonly loudness: RenderLoudnessReport;
}

export interface RunReport {
  readonly kind: 'run';
  readonly ingest: IngestReport;
  readonly plan: PlanReport;
  readonly render: RenderReport;
}

export type CliReport = IngestReport | PlanReport | RenderReport | RunReport;
