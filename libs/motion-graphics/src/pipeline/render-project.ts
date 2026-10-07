import type { MotionPipelinePorts } from './ports';

export interface RenderProjectOptions {
  outPath: string;
  fps: number;
  quality: string;
}

export async function renderProject(ports: MotionPipelinePorts, project: string, options: RenderProjectOptions): Promise<{ lines: string[]; outPath: string }> {
  await ports.render({ projectDir: project, outPath: options.outPath, fps: options.fps, quality: options.quality });
  return { lines: [`render: ${options.outPath}`], outPath: options.outPath };
}
