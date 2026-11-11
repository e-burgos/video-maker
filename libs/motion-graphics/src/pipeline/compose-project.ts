import { parseSfxBank, SFX_BANK_DIRECTORY, SFX_BANK_MANIFEST } from '../sfx/sfx-bank';
import type { SfxBank } from '../sfx/sfx-bank';
import { NO_SFX_PICKS, pickMotionSfx, PROJECT_SFX_DIR, sfxCreditLines } from '../sfx/motion-sfx-picks';
import { composeTemplate } from '../template/compose-template';
import type { MotionTimeline, SceneWords } from '../template/motion-timeline';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { readScript, TIMELINE_FILE, WORDS_FILE } from './project-files';

export const SFX_CREDITS_FILE = 'sfx-credits.json';

async function projectSfxBank(ports: MotionPipelinePorts, project: string): Promise<SfxBank | null> {
  const target = joinPath(project, PROJECT_SFX_DIR);
  const manifest = joinPath(target, SFX_BANK_MANIFEST);
  if (!(await ports.exists(manifest))) {
    const source = joinPath(ports.assetsRoot, SFX_BANK_DIRECTORY);
    if (!(await ports.exists(joinPath(source, SFX_BANK_MANIFEST)))) return null;
    await ports.copyTree(source, target);
  }
  return parseSfxBank(JSON.parse(await ports.readText(manifest)));
}

export async function composeProject(ports: MotionPipelinePorts, project: string): Promise<{ lines: string[]; scenes: number; durationSec: number }> {
  const script = await readScript(ports, project);
  const timeline = JSON.parse(await ports.readText(joinPath(project, TIMELINE_FILE))) as MotionTimeline;
  const words = JSON.parse(await ports.readText(joinPath(project, WORDS_FILE))) as SceneWords;
  const bank = await projectSfxBank(ports, project);
  const sfx = bank === null ? NO_SFX_PICKS : pickMotionSfx(bank, timeline, script, project);
  const html = composeTemplate(await ports.readText(joinPath(project, 'index.html.tpl')), script, timeline, words, sfx);
  await ports.writeText(joinPath(project, 'index.html'), html);
  await ports.writeText(joinPath(project, SFX_CREDITS_FILE), JSON.stringify(sfxCreditLines(sfx, html), null, 2));
  return { lines: [`compose: index.html · ${timeline.scenes.length} scenes · ${timeline.duration} s`], scenes: timeline.scenes.length, durationSec: timeline.duration };
}
