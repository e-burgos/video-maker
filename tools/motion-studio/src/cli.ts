import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  MotionStudioError,
  autoStoryboard,
  composeFromStoryboard,
  composeProject,
  initFromTemplate,
  isMotionStudioError,
  parseMotionBrief,
  parseMotionStoryboard,
  planProject,
  renderProject,
  voiceProject,
} from '@video-maker/motion-graphics';

import type { MotionDependencies } from './deps/motion-dependencies';

export interface CliOutcome {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

export const USAGE = [
  'usage: motion-studio <command> [options]',
  '  init <brand>/<video> <project>   copy a hand-made template, its brand kit and its music into a working project',
  '  storyboard <file> <project>      compose a project from a motion storyboard (scene catalog + brand manifest)',
  '  auto <brief.json> <project>      let the AI write the storyboard from a brief (script, images, brand), then compose it like storyboard',
  '  voice <project> [--takes N] [--only id,id]  synthesize every line (or only the listed scenes) keeping the most intelligible take',
  '  plan <project> [--no-beat-sync]  fit the beat grid, lay out scenes and duck the music',
  '  compose <project>                write index.html from index.html.tpl',
  '  render <project> [--out file] [--fps 30] [--quality delivery]',
];

async function runStoryboard(deps: MotionDependencies, storyboardPath: string, project: string) {
  const storyboard = parseMotionStoryboard(JSON.parse(await deps.readText(storyboardPath)));
  return composeFromStoryboard(deps, storyboard, dirname(storyboardPath), project);
}

async function runAuto(deps: MotionDependencies, briefPath: string, project: string) {
  const brief = parseMotionBrief(JSON.parse(await deps.readText(briefPath)));
  return autoStoryboard(deps, brief, dirname(briefPath), project);
}

export async function runCli(argv: string[], resolvePath: (raw: string) => string, deps: MotionDependencies): Promise<CliOutcome> {
  try {
    const { positionals, values } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        takes: { type: 'string', default: '5' },
        only: { type: 'string' },
        'beat-sync': { type: 'boolean', default: true },
        'no-beat-sync': { type: 'boolean', default: false },
        out: { type: 'string' },
        fps: { type: 'string', default: '30' },
        quality: { type: 'string', default: 'delivery' },
      },
    });
    const [command, first, second] = positionals;
    const project = first === undefined ? undefined : resolvePath(first);
    if (command === undefined || first === undefined || project === undefined) throw new MotionStudioError('CLI_USAGE', 'missing command or project');
    let stdout: string[];
    switch (command) {
      case 'init':
        if (second === undefined) throw new MotionStudioError('CLI_USAGE', 'init needs <brand>/<video> <project>');
        stdout = (await initFromTemplate(deps, deps.templatesRoot, first, resolvePath(second))).lines;
        break;
      case 'storyboard':
        if (second === undefined) throw new MotionStudioError('CLI_USAGE', 'storyboard needs <file> <project>');
        stdout = (await runStoryboard(deps, project, resolvePath(second))).lines;
        break;
      case 'auto':
        if (second === undefined) throw new MotionStudioError('CLI_USAGE', 'auto needs <brief.json> <project>');
        stdout = (await runAuto(deps, project, resolvePath(second))).lines;
        break;
      case 'voice': {
        const takes = Number(values.takes);
        if (!Number.isInteger(takes) || takes < 1) throw new MotionStudioError('CLI_USAGE', '--takes must be a positive integer');
        const only = values.only?.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
        stdout = (await voiceProject(deps, project, { takes, only })).lines;
        break;
      }
      case 'plan':
        stdout = (await planProject(deps, project, { beatSync: values['beat-sync'] && !values['no-beat-sync'] })).lines;
        break;
      case 'compose':
        stdout = (await composeProject(deps, project)).lines;
        break;
      case 'render': {
        const outPath = values.out ? resolvePath(values.out) : join(project, 'renders', 'video.mp4');
        stdout = (await renderProject(deps, project, { outPath, fps: Number(values.fps), quality: values.quality })).lines;
        break;
      }
      default:
        throw new MotionStudioError('CLI_USAGE', `unknown command "${command}"`);
    }
    return { exitCode: 0, stdout, stderr: [] };
  } catch (error) {
    const usage = isMotionStudioError(error) && error.code === 'CLI_USAGE';
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: usage ? 2 : 1, stdout: [], stderr: [`motion-studio: ${message}`, ...(usage ? USAGE : [])] };
  }
}
