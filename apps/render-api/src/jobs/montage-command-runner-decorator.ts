import type { CommandRunner, ResolvedBinaries } from '@video-maker/media-local';

import type { MontageStage } from './render-job';

export interface MontageStageObserver {
  readonly stageStarted: (stage: MontageStage) => void;
  readonly assetProcessed: (stage: 'probe' | 'transcribe') => void;
}

export function createStageObservingCommandRunner(
  runner: CommandRunner,
  binaries: ResolvedBinaries,
  observer: MontageStageObserver,
): CommandRunner {
  return {
    run: async (bin, args, opts) => {
      if (bin === binaries.ffprobe) {
        observer.stageStarted('probe');
        const result = await runner.run(bin, args, opts);
        observer.assetProcessed('probe');
        return result;
      }
      if (bin === binaries.ffmpeg || bin === binaries.whisperCli) {
        observer.stageStarted('transcribe');
        const result = await runner.run(bin, args, opts);
        if (bin === binaries.whisperCli) {
          observer.assetProcessed('transcribe');
        }
        return result;
      }
      return runner.run(bin, args, opts);
    },
  };
}
