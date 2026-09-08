import { nodeDirectoryReader, nodeEnsureDirectory, nodeFileStatReader, nodeWriteTextFile } from '@video-maker/auto-montage';
import { ExecaCommandRunner, nodeReadTextFile, resolveBinaries, systemClock } from '@video-maker/media-local';

import { StageFailedError } from '../errors/stage-failed-error';

import type { CliDependencies } from './cli-dependencies';
import type { TimelineRenderer } from './timeline-renderer';

const nodeTimelineRenderer: TimelineRenderer = async (timeline, request) => {
  const { renderTimeline, RenderTimelineError } = await import('@video-maker/composition-remotion/render');
  try {
    const result = await renderTimeline(timeline, { outPath: request.outPath, publicDir: request.publicDir });
    return {
      outPath: result.outPath,
      width: result.width,
      height: result.height,
      fps: result.fps,
      durationInFrames: result.durationInFrames,
    };
  } catch (cause) {
    if (cause instanceof RenderTimelineError) {
      throw new StageFailedError({ stage: 'render', resource: request.outPath, reason: cause.code, cause });
    }
    throw cause;
  }
};

export function createNodeCliDependencies(env: NodeJS.ProcessEnv): CliDependencies {
  return {
    runner: new ExecaCommandRunner(),
    resolveBinaries: () => resolveBinaries(env),
    readDirectory: nodeDirectoryReader,
    statFile: nodeFileStatReader,
    readTextFile: nodeReadTextFile,
    writeTextFile: nodeWriteTextFile,
    ensureDirectory: nodeEnsureDirectory,
    clock: systemClock,
    renderTimeline: nodeTimelineRenderer,
  };
}
