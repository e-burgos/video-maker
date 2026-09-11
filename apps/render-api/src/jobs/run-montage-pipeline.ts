import type { LogoMode, MediaProject, MontagePresetName } from '@video-maker/auto-montage';
import type { OutputPreset } from '@video-maker/timeline-core';
import { autoMontage, discoverAssets, ingestProject, toAbsolutePath } from '@video-maker/auto-montage';

import { PipelineStageError } from '../errors/pipeline-stage-error';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { translateMontageError } from '../errors/translate-montage-error';
import { assertMontageProjectIsIngestable } from '../store/montage-preconditions';
import { createStageObservingCommandRunner } from './montage-command-runner-decorator';
import { checkpoint } from './montage-pipeline-observer';
import type { MontagePipelineObserver } from './montage-pipeline-observer';
import type { MontageJobReport, MontageStage } from './render-job';

export interface MontagePipelineRequest {
  readonly project: MediaProject;
  readonly preset: MontagePresetName;
  readonly seed: number;
  readonly scriptPath?: string | null;
  readonly scriptText?: string | null;
  readonly logo?: LogoMode;
  readonly format?: OutputPreset;
}

async function resolveScriptText(
  request: MontagePipelineRequest,
  deps: RenderApiDependencies,
): Promise<string | undefined> {
  if (request.scriptText !== null && request.scriptText !== undefined) {
    return request.scriptText;
  }

  if (request.scriptPath === null || request.scriptPath === undefined) {
    return undefined;
  }

  try {
    return await deps.storage.readTextFile(toAbsolutePath(request.project, request.scriptPath));
  } catch {
    throw new PipelineStageError({
      code: 'MONTAGE_SCRIPT_NOT_FOUND',
      stage: 'plan',
      resource: request.scriptPath,
      expected: 'a readable project-relative path to the script the voice reads',
    });
  }
}

async function runMontageStage<T>(stage: MontageStage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw translateMontageError(cause, stage, null);
  }
}

export async function runMontagePipeline(
  request: MontagePipelineRequest,
  deps: RenderApiDependencies,
  observer: MontagePipelineObserver,
): Promise<MontageJobReport> {
  await assertMontageProjectIsIngestable(request.project, deps);

  checkpoint(observer, 'discover');
  observer.stageStarted('discover');

  const { binaries, rawRunner } = await runMontageStage('discover', async () => {
    const resolvedBinaries = await deps.resolveMontageBinaries();
    const commandRunner = await deps.createCommandRunner();
    return { binaries: resolvedBinaries, rawRunner: commandRunner };
  });

  const { findings } = await runMontageStage('discover', () =>
    discoverAssets(request.project, {
      readDirectory: deps.readDirectory,
      statFile: deps.statFile,
    }),
  );
  const totalAssets = findings.length;

  const runner = createStageObservingCommandRunner(rawRunner, binaries, {
    stageStarted: observer.stageStarted,
    assetProcessed: (stage) => observer.assetProcessed(stage, totalAssets),
  });

  const ingestResult = await runMontageStage('discover', () =>
    ingestProject(
      request.project,
      { binaries },
      {
        runner,
        readDirectory: deps.readDirectory,
        statFile: deps.statFile,
        readTextFile: deps.storage.readTextFile,
        writeTextFile: deps.storage.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
        clock: deps.clock,
      },
    ),
  );

  checkpoint(observer, 'plan');
  observer.stageStarted('plan');

  const scriptText = await resolveScriptText(request, deps);

  const montageResult = await runMontageStage('plan', () =>
    autoMontage(
      request.project,
      {
        preset: request.preset,
        seed: request.seed,
        logo: request.logo ?? 'auto',
        ...(request.format === undefined ? {} : { outputPreset: request.format }),
        ...(scriptText === undefined ? {} : { scriptText }),
      },
      {
        readTextFile: deps.storage.readTextFile,
        writeTextFile: deps.storage.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
      },
    ),
  );

  return {
    catalogPath: ingestResult.catalogPath,
    timelinePath: montageResult.timelinePath,
    editDecisionListPath: montageResult.edlPath,
    preset: request.preset,
    seed: request.seed,
    logoAssetId: montageResult.logoAssetId,
    scriptAlignment: montageResult.scriptAlignment,
  };
}
