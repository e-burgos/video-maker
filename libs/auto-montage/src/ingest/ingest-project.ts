import type { Clock, CommandRunner, ReadTextFile, ResolvedBinaries } from '@video-maker/media-local';
import { nodeReadTextFile, systemClock } from '@video-maker/media-local';

import type { AssetRole, Catalog, CatalogAsset, ProjectRelativePath } from '../catalog/catalog.schema';
import { CATALOG_SCHEMA_VERSION, CatalogSchema } from '../catalog/catalog.schema';
import { readCatalog } from '../catalog/read-catalog';
import { writeCatalog } from '../catalog/write-catalog';
import { AssetProbeFailedError } from '../errors/asset-probe-failed-error';
import { CatalogUnreadableError } from '../errors/catalog-unreadable-error';
import type { TranscriptionFailedError } from '../errors/transcription-failed-error';
import type { DirectoryReader } from '../fs/directory-reader';
import { nodeDirectoryReader } from '../fs/directory-reader';
import type { EnsureDirectory } from '../fs/ensure-directory';
import { nodeEnsureDirectory } from '../fs/ensure-directory';
import type { FileStatReader } from '../fs/file-stat-reader';
import { nodeFileStatReader } from '../fs/file-stat-reader';
import type { WriteTextFile } from '../fs/write-text-file';
import { nodeWriteTextFile } from '../fs/write-text-file';
import { guardEnsureDirectory, guardWriteTextFile } from '../fs/guard-raw-writes';
import type { MediaProject } from '../project/media-project';
import { catalogPath, toAbsolutePath, workPath } from '../project/project-paths';
import type { AssetFinding } from './discover-assets';
import { discoverAssets } from './discover-assets';
import { planIngestWork } from './plan-ingest-work';
import { probeAssets } from './probe-assets';
import { transcribeAssets } from './transcribe-assets';

const DEFAULT_LANGUAGE = 'auto';
const DEFAULT_TRANSCRIBE_ROLES: readonly AssetRole[] = ['aroll'];

export interface IngestOptions {
  readonly binaries: ResolvedBinaries;
  readonly language?: string;
  readonly transcribeRoles?: readonly AssetRole[];
}

export interface IngestDependencies {
  readonly runner: CommandRunner;
  readonly readDirectory?: DirectoryReader;
  readonly statFile?: FileStatReader;
  readonly readTextFile?: ReadTextFile;
  readonly writeTextFile?: WriteTextFile;
  readonly ensureDirectory?: EnsureDirectory;
  readonly clock?: Clock;
}

export interface IngestResult {
  readonly catalog: Catalog;
  readonly catalogPath: ProjectRelativePath;
  readonly probeFailures: readonly AssetProbeFailedError[];
  readonly transcriptionFailures: readonly TranscriptionFailedError[];
  readonly transcribedAssetIds: readonly string[];
  readonly reusedTranscriptionAssetIds: readonly string[];
  readonly reusedProbeAssetIds: readonly string[];
  readonly staleCatalogReplaced: boolean;
}

function basenameOfAbsolutePath(path: string): string {
  const segments = path.split(/[\\/]/u);
  const last = segments[segments.length - 1];
  return last === undefined || last.length === 0 ? path : last;
}

function compareByString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

export async function ingestProject(
  project: MediaProject,
  opts: IngestOptions,
  deps: IngestDependencies,
): Promise<IngestResult> {
  const readDirectory = deps.readDirectory ?? nodeDirectoryReader;
  const statFile = deps.statFile ?? nodeFileStatReader;
  const readTextFile = deps.readTextFile ?? nodeReadTextFile;
  const clock = deps.clock ?? systemClock;
  const writeTextFile = guardWriteTextFile(project, deps.writeTextFile ?? nodeWriteTextFile);
  const ensureDirectory = guardEnsureDirectory(project, deps.ensureDirectory ?? nodeEnsureDirectory);

  const language = opts.language ?? DEFAULT_LANGUAGE;
  const transcribeRoles = opts.transcribeRoles ?? DEFAULT_TRANSCRIBE_ROLES;
  const modelBasename = basenameOfAbsolutePath(opts.binaries.whisperModel);

  await ensureDirectory(toAbsolutePath(project, workPath()));
  await ensureDirectory(toAbsolutePath(project, workPath('transcripts')));
  await ensureDirectory(toAbsolutePath(project, workPath('audio')));
  await ensureDirectory(toAbsolutePath(project, workPath('whisper')));

  let previousCatalog: Catalog | null;
  let staleCatalogReplaced = false;
  try {
    previousCatalog = await readCatalog(project, { readTextFile });
  } catch (error) {
    if (error instanceof CatalogUnreadableError) {
      previousCatalog = null;
      staleCatalogReplaced = true;
    } else {
      throw error;
    }
  }

  const { findings, ignored } = await discoverAssets(project, { readDirectory, statFile });

  const plan = planIngestWork(findings, previousCatalog, {
    engine: 'whisper.cpp',
    model: modelBasename,
    language,
    transcribeRoles,
  });

  const reusedProbeAssetIds: string[] = [];
  const reusedCatalogAssets: CatalogAsset[] = [];
  const findingsToProbe: AssetFinding[] = [];
  for (const entry of plan.assetPlans) {
    if (entry.reuse === undefined) {
      findingsToProbe.push(entry.finding);
      continue;
    }
    reusedProbeAssetIds.push(entry.finding.relativePath);
    reusedCatalogAssets.push(entry.reuse);
  }

  const probeResult = await probeAssets(
    project,
    findingsToProbe,
    { runner: deps.runner, clock },
    { ffprobePath: opts.binaries.ffprobe, ffmpegPath: opts.binaries.ffmpeg },
  );

  const assets: CatalogAsset[] = [...reusedCatalogAssets, ...probeResult.assets].sort((left, right) =>
    compareByString(left.asset.id, right.asset.id),
  );

  const successfulAssetIds = new Set(assets.map((entry) => entry.asset.id));
  const transcribablePlans = plan.transcriptionPlans.filter((entry) => successfulAssetIds.has(entry.assetId));

  const transcribeResult = await transcribeAssets(
    project,
    transcribablePlans,
    { runner: deps.runner, readTextFile, writeTextFile, ensureDirectory },
    {
      modelPath: opts.binaries.whisperModel,
      language,
      ffmpegPath: opts.binaries.ffmpeg,
      whisperPath: opts.binaries.whisperCli,
    },
  );

  const catalog = CatalogSchema.parse({
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: project.slug,
    assets,
    transcripts: transcribeResult.transcripts,
    ignored,
    probeFailures: probeResult.failures,
  });

  await writeCatalog(project, catalog, { writeTextFile, ensureDirectory });

  return {
    catalog,
    catalogPath: catalogPath(),
    probeFailures: probeResult.failures.map(
      (failure) => new AssetProbeFailedError({ path: failure.path, cause: failure }),
    ),
    transcriptionFailures: transcribeResult.failures,
    transcribedAssetIds: transcribeResult.transcribedAssetIds,
    reusedTranscriptionAssetIds: transcribeResult.reusedAssetIds,
    reusedProbeAssetIds,
    staleCatalogReplaced,
  };
}
