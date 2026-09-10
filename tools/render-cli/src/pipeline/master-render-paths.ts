import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

export const RENDER_WORK_SEGMENT = 'work/renders';
export const MUTED_VIDEO_FILENAME = 'video-muted.mp4';
export const MASTER_AUDIO_FILENAME = 'master.wav';

export interface MasterRenderPaths {
  readonly publicDir: string;
  readonly workDir: string;
  readonly outDir: string;
  readonly mutedVideoPath: string;
  readonly masterAudioPath: string;
  readonly deliverablePath: string;
}

export function resolveMasterRenderPaths(project: MediaProject): MasterRenderPaths {
  const workDir = join(project.root, RENDER_WORK_SEGMENT, project.slug);

  return {
    publicDir: project.root,
    workDir,
    outDir: project.outDir,
    mutedVideoPath: join(workDir, MUTED_VIDEO_FILENAME),
    masterAudioPath: join(workDir, MASTER_AUDIO_FILENAME),
    deliverablePath: join(project.outDir, `${project.slug}.mp4`),
  };
}
