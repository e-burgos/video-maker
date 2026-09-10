import type { MediaProject } from '@video-maker/auto-montage';
import type { Timeline } from '@video-maker/timeline-core';

import type { CliDependencies } from '../deps/cli-dependencies';
import type { MixLoudnessReport, RenderOutcome } from '../deps/timeline-renderer';
import { translateLibError } from '../errors/translate-lib-error';
import { assertTimelineExists } from '../pipeline/assert-project-preconditions';
import { resolveMasterRenderPaths } from '../pipeline/master-render-paths';
import type { MasterRenderPaths } from '../pipeline/master-render-paths';
import { readTimelineDocument } from '../pipeline/read-timeline-document';
import type { RenderReport } from '../report/cli-report';
import { toRenderReport } from '../report/to-reports';

async function masterAudio(
  timeline: Timeline,
  paths: MasterRenderPaths,
  deps: CliDependencies,
): Promise<MixLoudnessReport> {
  try {
    await deps.mixTimelineAudio(timeline, {
      outPath: paths.masterAudioPath,
      projectRoot: paths.publicDir,
    });
    await deps.muxAudioIntoVideo({
      videoPath: paths.mutedVideoPath,
      audioPath: paths.masterAudioPath,
      outPath: paths.deliverablePath,
    });
    return await deps.verifyMixLoudness(timeline, paths.deliverablePath);
  } catch (cause) {
    throw translateLibError(cause, 'render', paths.deliverablePath);
  }
}

export async function renderCommand(project: MediaProject, deps: CliDependencies): Promise<RenderReport> {
  await assertTimelineExists(project, deps);
  const timeline = await readTimelineDocument(project, deps);
  const paths = resolveMasterRenderPaths(project);

  await deps.ensureDirectory(paths.workDir);
  await deps.ensureDirectory(paths.outDir);

  const rendered: RenderOutcome = await deps.renderTimeline(timeline, {
    outPath: paths.mutedVideoPath,
    publicDir: paths.publicDir,
  });

  const loudness = await masterAudio(timeline, paths, deps);

  return toRenderReport(rendered, loudness, paths, project);
}
