import { autoMontage } from '@video-maker/auto-montage';
import type { AutoMontageResult, MediaProject } from '@video-maker/auto-montage';

import type { PlanOptions } from '../args/parse-cli-args';
import type { CliDependencies } from '../deps/cli-dependencies';
import { translateLibError } from '../errors/translate-lib-error';
import { assertCatalogExists } from '../pipeline/assert-project-preconditions';
import type { PlanReport } from '../report/cli-report';
import { toPlanReport } from '../report/to-reports';

async function runAutoMontage(
  project: MediaProject,
  options: PlanOptions,
  deps: CliDependencies,
): Promise<AutoMontageResult> {
  try {
    return await autoMontage(
      project,
      { preset: options.preset, seed: options.seed },
      {
        readTextFile: deps.readTextFile,
        writeTextFile: deps.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
      },
    );
  } catch (cause) {
    throw translateLibError(cause, 'plan', null);
  }
}

export async function planCommand(
  project: MediaProject,
  options: PlanOptions,
  deps: CliDependencies,
): Promise<PlanReport> {
  await assertCatalogExists(project, deps);
  const result = await runAutoMontage(project, options, deps);
  return toPlanReport(result);
}
