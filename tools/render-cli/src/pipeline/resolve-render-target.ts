import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

export interface RenderTarget {
  readonly publicDir: string;
  readonly outPath: string;
}

export function resolveRenderTarget(project: MediaProject): RenderTarget {
  return { publicDir: project.root, outPath: join(project.outDir, `${project.slug}.mp4`) };
}
