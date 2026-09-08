import { ingestProject } from '@video-maker/auto-montage';
import type { IngestResult, MediaProject } from '@video-maker/auto-montage';
import type { ResolvedBinaries } from '@video-maker/media-local';

import type { CliDependencies } from '../deps/cli-dependencies';
import { translateLibError } from '../errors/translate-lib-error';
import { assertProjectIsIngestable } from '../pipeline/assert-project-preconditions';
import type { IngestReport } from '../report/cli-report';
import { toIngestReport } from '../report/to-reports';

function resourceOfBinaryError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const binary = (error as { binary?: unknown }).binary;
  return typeof binary === 'string' ? binary : null;
}

async function resolveIngestBinaries(deps: CliDependencies): Promise<ResolvedBinaries> {
  try {
    return await deps.resolveBinaries();
  } catch (cause) {
    throw translateLibError(cause, 'ingest', resourceOfBinaryError(cause));
  }
}

async function runIngestProject(
  project: MediaProject,
  binaries: ResolvedBinaries,
  deps: CliDependencies,
): Promise<IngestResult> {
  try {
    return await ingestProject(
      project,
      { binaries },
      {
        runner: deps.runner,
        readDirectory: deps.readDirectory,
        statFile: deps.statFile,
        readTextFile: deps.readTextFile,
        writeTextFile: deps.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
        clock: deps.clock,
      },
    );
  } catch (cause) {
    throw translateLibError(cause, 'ingest', null);
  }
}

export async function ingestCommand(project: MediaProject, deps: CliDependencies): Promise<IngestReport> {
  await assertProjectIsIngestable(project, deps);
  const binaries = await resolveIngestBinaries(deps);
  const result = await runIngestProject(project, binaries, deps);
  return toIngestReport(result);
}
