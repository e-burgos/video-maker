import type { AssetRole, AutoMontageResult, IngestResult, MediaProject } from '@video-maker/auto-montage';
import { relative } from 'node:path/posix';

import type { MixLoudnessReport, RenderOutcome } from '../deps/timeline-renderer';
import type { MasterRenderPaths } from '../pipeline/master-render-paths';

import type { AssetRoleCount, IngestReport, PlanReport, RenderReport } from './cli-report';

const ASSET_ROLE_ORDER: readonly AssetRole[] = ['aroll', 'broll', 'image', 'audio'];

function toProjectRelativePath(project: MediaProject, absolutePath: string): string {
  return relative(project.root, absolutePath);
}

function countAssetsByRole(roles: readonly AssetRole[]): readonly AssetRoleCount[] {
  return ASSET_ROLE_ORDER.map((role) => ({
    role,
    count: roles.filter((candidate) => candidate === role).length,
  }));
}

export function toIngestReport(result: IngestResult): IngestReport {
  return {
    kind: 'ingest',
    catalogPath: result.catalogPath,
    assetCounts: countAssetsByRole(result.catalog.assets.map((asset) => asset.role)),
    transcribedCount: result.transcribedAssetIds.length,
    reusedTranscriptionCount: result.reusedTranscriptionAssetIds.length,
    probeFailurePaths: [...result.probeFailures.map((failure) => failure.path)].sort(),
    transcriptionFailures: result.transcriptionFailures.map((failure) => ({
      assetId: failure.assetId,
      failedStage: failure.stage,
    })),
    staleCatalogReplaced: result.staleCatalogReplaced,
  };
}

export function toPlanReport(result: AutoMontageResult): PlanReport {
  return {
    kind: 'plan',
    timelinePath: result.timelinePath,
    edlPath: result.edlPath,
    editedDurationMs: result.editedDurationMs,
    transcriptionSource: result.transcriptionSource,
    conceptTerms: result.concepts.map((concept) => concept.term),
    brollOverlayCount: result.brollOverlays.length,
    brollRejections: result.brollRejections.map((rejection) => ({
      conceptTerm: rejection.conceptTerm,
      startMs: rejection.startMs,
      reason: rejection.reason,
    })),
    logoAssetId: result.logoAssetId,
    scriptAlignment: result.scriptAlignment,
  };
}

export function toRenderReport(
  outcome: RenderOutcome,
  loudness: MixLoudnessReport,
  paths: MasterRenderPaths,
  project: MediaProject,
): RenderReport {
  return {
    kind: 'render',
    outPath: toProjectRelativePath(project, paths.deliverablePath),
    width: outcome.width,
    height: outcome.height,
    fps: outcome.fps,
    durationInFrames: outcome.durationInFrames,
    mutedVideoPath: toProjectRelativePath(project, paths.mutedVideoPath),
    masterAudioPath: toProjectRelativePath(project, paths.masterAudioPath),
    loudness,
  };
}
