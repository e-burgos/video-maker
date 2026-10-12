import { join } from 'node:path/posix';

import { SAMPLE_VIDEO_SUFFIX } from '../jobs/sample-job-params';

export const RENDER_WORK_SEGMENT = 'work/renders';
export const RENDER_OUT_SEGMENT = 'out';
export const MUTED_VIDEO_FILENAME = 'video-muted.mp4';
export const MASTER_AUDIO_FILENAME = 'master.wav';

export interface RenderPipelineFile {
  readonly path: string;
  readonly resource: string;
}

export interface RenderPipelinePaths {
  readonly publicDir: string;
  readonly workDir: RenderPipelineFile;
  readonly outDir: RenderPipelineFile;
  readonly mutedVideo: RenderPipelineFile;
  readonly masterAudio: RenderPipelineFile;
  readonly deliverable: RenderPipelineFile;
}

export function resolveRenderPipelinePaths(
  projectRoot: string,
  renderId: string,
  sample = false,
): RenderPipelinePaths {
  const file = (relative: string): RenderPipelineFile => ({
    path: join(projectRoot, relative),
    resource: relative,
  });

  const workRelative = join(RENDER_WORK_SEGMENT, renderId);

  return {
    publicDir: projectRoot,
    workDir: file(workRelative),
    outDir: file(RENDER_OUT_SEGMENT),
    mutedVideo: file(join(workRelative, MUTED_VIDEO_FILENAME)),
    masterAudio: file(join(workRelative, MASTER_AUDIO_FILENAME)),
    deliverable: file(join(RENDER_OUT_SEGMENT, `${renderId}${sample ? SAMPLE_VIDEO_SUFFIX : '.mp4'}`)),
  };
}
