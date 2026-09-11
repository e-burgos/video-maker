import { autoMontage } from '@video-maker/auto-montage';
import type { AutoMontageResult, MediaProject } from '@video-maker/auto-montage';

import { StageInputMissingError } from '../errors/stage-input-missing-error';

import type { PlanOptions } from '../args/parse-cli-args';
import type { CliDependencies } from '../deps/cli-dependencies';
import { translateLibError } from '../errors/translate-lib-error';
import { assertCatalogExists } from '../pipeline/assert-project-preconditions';
import type { PlanReport } from '../report/cli-report';
import { toPlanReport } from '../report/to-reports';

async function readScript(options: PlanOptions, deps: CliDependencies): Promise<string | undefined> {
  if (options.scriptPath === null) {
    return undefined;
  }

  try {
    return await deps.readTextFile(options.scriptPath);
  } catch {
    throw new StageInputMissingError({
      stage: 'plan',
      resource: options.scriptPath,
      reason: 'script-missing',
      hint: 'pass --script with a readable path to the script the voice reads',
    });
  }
}

async function runAutoMontage(
  project: MediaProject,
  options: PlanOptions,
  scriptText: string | undefined,
  deps: CliDependencies,
): Promise<AutoMontageResult> {
  try {
    return await autoMontage(
      project,
      {
        preset: options.preset,
        seed: options.seed,
        logo: options.logo,
        outputPreset: options.format,
        voice: options.voice,
        ...(options.captionStyle === undefined ? {} : { captionStyle: options.captionStyle }),
        ...(options.pruneSilences === undefined ? {} : { pruneSilences: options.pruneSilences }),
        ...(scriptText === undefined ? {} : { scriptText }),
      },
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
  const scriptText = await readScript(options, deps);
  const result = await runAutoMontage(project, options, scriptText, deps);
  return toPlanReport(result);
}
