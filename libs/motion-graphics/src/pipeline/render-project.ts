import type { MotionTimeline } from '../template/motion-timeline';
import { joinPath } from './join-path';
import { TIMELINE_FILE } from './project-files';
import type { MotionPipelinePorts } from './ports';

export interface RenderProjectOptions {
  outPath: string;
  fps: number;
  quality: string;
}

function creditsPathFor(outPath: string): string {
  return `${outPath.replace(/\.[^./]+$/u, '')}.credits.txt`;
}

async function readMusicCredit(ports: MotionPipelinePorts, project: string): Promise<string> {
  const timelinePath = joinPath(project, TIMELINE_FILE);
  if (!(await ports.exists(timelinePath))) return '';
  const timeline = JSON.parse(await ports.readText(timelinePath)) as Partial<MotionTimeline>;
  return timeline.musicCredit ?? '';
}

export async function renderProject(ports: MotionPipelinePorts, project: string, options: RenderProjectOptions): Promise<{ lines: string[]; outPath: string; creditsPath: string | null; musicCredit: string | null }> {
  await ports.render({ projectDir: project, outPath: options.outPath, fps: options.fps, quality: options.quality });
  const credit = await readMusicCredit(ports, project);
  if (credit === '') return { lines: [`render: ${options.outPath}`], outPath: options.outPath, creditsPath: null, musicCredit: null };
  const creditsPath = creditsPathFor(options.outPath);
  await ports.writeText(creditsPath, `Música: ${credit}\n`);
  return { lines: [`render: ${options.outPath}`, `credits: ${creditsPath}`], outPath: options.outPath, creditsPath, musicCredit: credit };
}
