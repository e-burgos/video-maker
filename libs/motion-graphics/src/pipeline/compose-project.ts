import { composeTemplate } from '../template/compose-template';
import type { MotionTimeline, SceneWords } from '../template/motion-timeline';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { readScript, TIMELINE_FILE, WORDS_FILE } from './project-files';

export async function composeProject(ports: MotionPipelinePorts, project: string): Promise<{ lines: string[]; scenes: number; durationSec: number }> {
  const script = await readScript(ports, project);
  const timeline = JSON.parse(await ports.readText(joinPath(project, TIMELINE_FILE))) as MotionTimeline;
  const words = JSON.parse(await ports.readText(joinPath(project, WORDS_FILE))) as SceneWords;
  const html = composeTemplate(await ports.readText(joinPath(project, 'index.html.tpl')), script, timeline, words);
  await ports.writeText(joinPath(project, 'index.html'), html);
  return { lines: [`compose: index.html · ${timeline.scenes.length} scenes · ${timeline.duration} s`], scenes: timeline.scenes.length, durationSec: timeline.duration };
}
