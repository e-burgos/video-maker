import { composeStoryboard } from '../compose/compose-storyboard';
import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { copyMusic, copySharedAssets, readBrand, SCRIPT_FILE, toJson } from './project-files';

export async function composeFromStoryboard(
  ports: MotionPipelinePorts,
  storyboard: MotionStoryboard,
  sourceDir: string,
  project: string,
): Promise<{ lines: string[] }> {
  const brand = await readBrand(ports, storyboard.brand);
  const composed = composeStoryboard(storyboard, brand);
  await copySharedAssets(ports, storyboard.brand, project);
  for (const image of composed.images) {
    const target = joinPath(project, image);
    if (sourceDir !== project) {
      const source = joinPath(sourceDir, image);
      if (!(await ports.exists(source))) throw new MotionStudioError('ASSET_MISSING', `image "${image}" not found next to the storyboard`);
      await ports.copyFile(source, target);
    } else if (!(await ports.exists(target))) throw new MotionStudioError('ASSET_MISSING', `image "${image}" not found in the project`);
  }
  if (composed.musicSource !== null && composed.script.music !== null) await copyMusic(ports, project, composed.musicSource, composed.script.music.file);
  await ports.writeText(joinPath(project, 'index.html.tpl'), composed.template);
  await ports.writeText(joinPath(project, SCRIPT_FILE), toJson(composed.script, 2));
  if (sourceDir !== project) await ports.writeText(joinPath(project, 'storyboard.json'), toJson(storyboard, 2));
  return { lines: [`storyboard: ${storyboard.title} · ${storyboard.scenes.length} scenes · ${storyboard.format} · music ${composed.script.music?.file ?? 'none'} → ${project}`] };
}
