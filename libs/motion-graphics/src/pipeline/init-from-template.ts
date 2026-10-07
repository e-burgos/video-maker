import { BRAND_ASSET_DIR } from '../compose/compose-storyboard';
import { MotionStudioError } from '../errors/motion-studio-error';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { copyMusic, copySharedAssets, readScript, SCRIPT_FILE } from './project-files';

export async function initFromTemplate(ports: MotionPipelinePorts, templatesRoot: string, template: string, project: string): Promise<{ lines: string[] }> {
  const [brand, video] = template.split('/');
  if (!brand || !video) throw new MotionStudioError('CLI_USAGE', 'init expects <brand>/<video>, e.g. displayads/presentacion');
  const videoDir = joinPath(templatesRoot, brand, video);
  if (!(await ports.exists(joinPath(videoDir, SCRIPT_FILE)))) throw new MotionStudioError('CLI_USAGE', `template ${template} not found`);
  await copySharedAssets(ports, brand, project);
  const handKit = joinPath(templatesRoot, brand, '_brand');
  if (await ports.exists(handKit)) await ports.copyTree(handKit, joinPath(project, 'assets'));
  await ports.copyTree(videoDir, project);
  const script = await readScript(ports, project);
  if (script.music !== null) await copyMusic(ports, project, joinPath(BRAND_ASSET_DIR, 'music', script.music.file), script.music.file);
  return { lines: [`init: ${template} → ${project}`] };
}
