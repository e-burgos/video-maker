import type { Clock, CommandRunner } from '@video-maker/media-local';
import { isMediaLocalError, probeMedia } from '@video-maker/media-local';
import type { MediaAsset } from '@video-maker/timeline-core';

import type { MediaProject } from '../project/media-project';
import { toAbsolutePath } from '../project/project-paths';
import type { AssetFinding } from './discover-assets';

const PROBE_FAILURE_ERROR_CODES = ['BINARY_NOT_FOUND', 'COMMAND_FAILED', 'UNPARSEABLE_OUTPUT', 'UNKNOWN'] as const;

export type ProbeFailureErrorCode = (typeof PROBE_FAILURE_ERROR_CODES)[number];

export interface ProbedAsset {
  readonly role: AssetFinding['role'];
  readonly fingerprint: AssetFinding['fingerprint'];
  readonly asset: MediaAsset;
}

export interface ProbeFailure {
  readonly path: string;
  readonly errorCode: ProbeFailureErrorCode;
  readonly message: string;
}

export interface ProbeAssetsResult {
  readonly assets: readonly ProbedAsset[];
  readonly failures: readonly ProbeFailure[];
}

export interface ProbeAssetsDependencies {
  readonly runner: CommandRunner;
  readonly clock: Clock;
}

export interface ProbeAssetsOptions {
  readonly ffprobePath?: string;
}

function compareByString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function isProbeFailureErrorCode(code: string): code is ProbeFailureErrorCode {
  return (PROBE_FAILURE_ERROR_CODES as readonly string[]).includes(code);
}

function errorCodeOf(error: unknown): ProbeFailureErrorCode {
  return isMediaLocalError(error) && isProbeFailureErrorCode(error.code) ? error.code : 'UNKNOWN';
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Error desconocido al sondear el asset.';
}

async function probeFinding(
  project: MediaProject,
  finding: AssetFinding,
  deps: ProbeAssetsDependencies,
  options: ProbeAssetsOptions,
): Promise<ProbedAsset> {
  const absolutePath = toAbsolutePath(project, finding.relativePath);
  const probedAsset = await probeMedia(absolutePath, deps.runner, {
    assetId: finding.relativePath,
    clock: deps.clock,
    ...(options.ffprobePath !== undefined ? { ffprobePath: options.ffprobePath } : {}),
  });

  return {
    role: finding.role,
    fingerprint: finding.fingerprint,
    asset: { ...probedAsset, path: finding.relativePath },
  };
}

export async function probeAssets(
  project: MediaProject,
  findings: readonly AssetFinding[],
  deps: ProbeAssetsDependencies,
  options: ProbeAssetsOptions = {},
): Promise<ProbeAssetsResult> {
  const assets: ProbedAsset[] = [];
  const failures: ProbeFailure[] = [];

  for (const finding of findings) {
    try {
      assets.push(await probeFinding(project, finding, deps, options));
    } catch (error) {
      failures.push({
        path: finding.relativePath,
        errorCode: errorCodeOf(error),
        message: messageOf(error),
      });
    }
  }

  assets.sort((a, b) => compareByString(a.asset.id, b.asset.id));
  failures.sort((a, b) => compareByString(a.path, b.path));

  return { assets, failures };
}
