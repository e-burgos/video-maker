import type { TranscriptionEngine } from '@video-maker/timeline-core';

import type { AssetFingerprint, Catalog, CatalogAsset, TranscriptRef } from '../catalog/catalog.schema';
import type { AssetFinding } from './discover-assets';
import type { AssetRole } from './classify-entry';
import { buildTranscriptionKey } from './transcription-key';

export interface PlanIngestWorkOptions {
  readonly engine: TranscriptionEngine;
  readonly model: string;
  readonly language: string;
  readonly transcribeRoles: readonly AssetRole[];
}

export interface AssetProbePlanEntry {
  readonly finding: AssetFinding;
  readonly reuse: CatalogAsset | undefined;
}

export interface TranscriptionPlanEntry {
  readonly assetId: string;
  readonly fingerprint: AssetFingerprint;
  readonly reuseCandidate: TranscriptRef | undefined;
}

export interface PlanIngestWorkResult {
  readonly assetPlans: readonly AssetProbePlanEntry[];
  readonly transcriptionPlans: readonly TranscriptionPlanEntry[];
}

function fingerprintsMatch(left: AssetFingerprint, right: AssetFingerprint): boolean {
  return left.sizeBytes === right.sizeBytes && left.modifiedAtMs === right.modifiedAtMs;
}

function findPreviousAsset(previousCatalog: Catalog | null, assetId: string): CatalogAsset | undefined {
  return previousCatalog?.assets.find((entry) => entry.asset.id === assetId);
}

function findPreviousTranscript(previousCatalog: Catalog | null, assetId: string): TranscriptRef | undefined {
  return previousCatalog?.transcripts.find((entry) => entry.assetId === assetId);
}

function planAssetReuse(finding: AssetFinding, previousCatalog: Catalog | null): CatalogAsset | undefined {
  const previous = findPreviousAsset(previousCatalog, finding.relativePath);
  if (previous === undefined) {
    return undefined;
  }
  return fingerprintsMatch(previous.fingerprint, finding.fingerprint) ? previous : undefined;
}

function planTranscriptionReuse(
  finding: AssetFinding,
  previousCatalog: Catalog | null,
  options: PlanIngestWorkOptions,
): TranscriptRef | undefined {
  const previous = findPreviousTranscript(previousCatalog, finding.relativePath);
  if (previous === undefined) {
    return undefined;
  }

  const currentKey = buildTranscriptionKey({
    assetId: finding.relativePath,
    sizeBytes: finding.fingerprint.sizeBytes,
    modifiedAtMs: finding.fingerprint.modifiedAtMs,
    engine: options.engine,
    model: options.model,
    language: options.language,
  });

  const previousKey = buildTranscriptionKey({
    assetId: previous.assetId,
    sizeBytes: previous.fingerprint.sizeBytes,
    modifiedAtMs: previous.fingerprint.modifiedAtMs,
    engine: previous.engine,
    model: previous.model,
    language: previous.language,
  });

  return currentKey === previousKey ? previous : undefined;
}

export function planIngestWork(
  findings: readonly AssetFinding[],
  previousCatalog: Catalog | null,
  options: PlanIngestWorkOptions,
): PlanIngestWorkResult {
  const assetPlans = findings.map((finding) => ({
    finding,
    reuse: planAssetReuse(finding, previousCatalog),
  }));

  const transcriptionPlans = findings
    .filter((finding) => options.transcribeRoles.includes(finding.role))
    .map((finding) => ({
      assetId: finding.relativePath,
      fingerprint: finding.fingerprint,
      reuseCandidate: planTranscriptionReuse(finding, previousCatalog, options),
    }));

  return { assetPlans, transcriptionPlans };
}
