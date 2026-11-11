import type { MotionTimeline } from '../template/motion-timeline';
import { SFX_CREDITS_FILE } from './compose-project';
import { joinPath } from './join-path';
import { TIMELINE_FILE } from './project-files';
import { COMPOSITION_FILE, truncateCompositionDuration } from './sample-composition';
import type { MotionPipelinePorts, RenderRequest } from './ports';

export interface RenderProjectOptions {
  outPath: string;
  fps: number;
  quality: string;
  sampleSeconds?: number;
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

async function renderCutToSample(ports: MotionPipelinePorts, project: string, seconds: number, request: RenderRequest): Promise<void> {
  const compositionPath = joinPath(project, COMPOSITION_FILE);
  const full = await ports.readText(compositionPath);
  await ports.writeText(compositionPath, truncateCompositionDuration(full, seconds));
  try {
    await ports.render(request);
  } finally {
    await ports.writeText(compositionPath, full);
  }
}

async function readSfxCredits(ports: MotionPipelinePorts, project: string): Promise<string[]> {
  const path = joinPath(project, SFX_CREDITS_FILE);
  if (!(await ports.exists(path))) return [];
  const parsed: unknown = JSON.parse(await ports.readText(path));
  return Array.isArray(parsed) ? parsed.filter((line): line is string => typeof line === 'string') : [];
}

export async function renderProject(ports: MotionPipelinePorts, project: string, options: RenderProjectOptions): Promise<{ lines: string[]; outPath: string; creditsPath: string | null; musicCredit: string | null; sfxCredits: string[] }> {
  const request: RenderRequest = { projectDir: project, outPath: options.outPath, fps: options.fps, quality: options.quality };
  if (options.sampleSeconds === undefined) {
    await ports.render(request);
  } else {
    await renderCutToSample(ports, project, options.sampleSeconds, request);
  }
  const credit = await readMusicCredit(ports, project);
  const sfxCredits = await readSfxCredits(ports, project);
  const lines = [...(credit === '' ? [] : [`Música: ${credit}`]), ...sfxCredits];
  const musicCredit = credit === '' ? null : credit;
  if (lines.length === 0 || options.sampleSeconds !== undefined) return { lines: [`render: ${options.outPath}`], outPath: options.outPath, creditsPath: null, musicCredit: options.sampleSeconds === undefined ? musicCredit : null, sfxCredits };
  const creditsPath = creditsPathFor(options.outPath);
  await ports.writeText(creditsPath, `${lines.join('\n')}\n`);
  return { lines: [`render: ${options.outPath}`, `credits: ${creditsPath}`], outPath: options.outPath, creditsPath, musicCredit, sfxCredits };
}
