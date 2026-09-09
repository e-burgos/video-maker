import type { MediaProject, MontagePresetName } from '@video-maker/auto-montage';
import { autoMontage, discoverAssets, ingestProject } from '@video-maker/auto-montage';

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

  const montageResult = await runMontageStage('plan', () =>
    autoMontage(
      request.project,
      { preset: request.preset, seed: request.seed },
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
  };
}
