import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { fitBeatGrid } from './beats/fit-beat-grid';
import { parseHyperframesBeats } from './beats/parse-hyperframes-beats';
import type { MotionDependencies } from './deps/motion-dependencies';
import { wavDurationSec } from './deps/wav-duration';
import { isMotionStudioError, MotionStudioError } from './errors/motion-studio-error';
import { parseMotionScript } from './script/motion-script';
import type { MotionScript } from './script/motion-script';
import { composeTemplate } from './template/compose-template';
import type { MotionTimeline, SceneWords } from './template/motion-timeline';
import { buildDuckAutomation } from './timeline/build-duck-automation';
import { layoutScenes } from './timeline/layout-scenes';
import { pickBestTake } from './voice/pick-best-take';

export interface CliOutcome {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

export const USAGE = [
  'usage: motion-studio <command> [options]',
  '  init <brand>/<video> <project>   copy a template, its brand kit and its music into a working project',
  '  voice <project> [--takes N]      synthesize every line keeping the most intelligible take',
  '  plan <project> [--no-beat-sync]  fit the beat grid, lay out scenes and duck the music',
  '  compose <project>                write index.html from index.html.tpl',
  '  render <project> [--out file] [--fps 30] [--quality delivery]',
];

const SCRIPT = 'script.json';
const TIMELINE = 'timeline.json';
const WORDS = 'words.json';
const MUSIC_TAIL = 0.5;

async function readScript(deps: MotionDependencies, project: string): Promise<MotionScript> {
  return parseMotionScript(JSON.parse(await deps.readText(join(project, SCRIPT))));
}

async function initCommand(deps: MotionDependencies, template: string, project: string): Promise<string[]> {
  const [brand, video] = template.split('/');
  if (!brand || !video) throw new MotionStudioError('CLI_USAGE', 'init expects <brand>/<video>, e.g. displayads/presentacion');
  const videoDir = join(deps.templatesRoot, brand, video);
  if (!(await deps.exists(join(videoDir, SCRIPT)))) throw new MotionStudioError('CLI_USAGE', `template ${template} not found`);
  await deps.copyTree(join(deps.templatesRoot, brand, '_brand'), join(project, 'assets'));
  await deps.copyTree(videoDir, project);
  const script = await readScript(deps, project);
  await deps.copyFile(join(deps.templatesRoot, brand, '_music', script.music.file), join(project, 'assets', 'music', script.music.file));
  return [`init: ${template} → ${project}`];
}

async function voiceCommand(deps: MotionDependencies, project: string, takes: number): Promise<string[]> {
  const script = await readScript(deps, project);
  const words: SceneWords = {};
  const report: string[] = [];
  for (const scene of script.scenes) {
    const finalPath = join(project, 'assets', 'audio', `vo-${scene.id}.wav`);
    const { best, attempts } = await pickBestTake(
      scene.vo,
      {
        synthesizeTake: async (take) => {
          const path = join(project, 'assets', 'audio', `vo-${scene.id}.take${take}.wav`);
          await deps.synthesize({ text: scene.vo, voice: script.voice, lengthScale: script.lengthScale, outPath: path });
          return { path, durationSec: wavDurationSec(await deps.readBytes(path)) };
        },
        transcribeTake: (path) => deps.transcribe(path),
      },
      { takes },
    );
    await deps.copyFile(best.path, finalPath);
    for (const attempt of attempts) await deps.removeFile(attempt.path);
    words[scene.id] = best.transcript.words.map((w) => ({ w: w.text, t: w.start, e: w.end }));
    report.push(`voice ${scene.id}: take ${best.take + 1}/${attempts.length} · ${best.score} · ${best.transcript.text}`);
  }
  await deps.writeText(join(project, WORDS), `${JSON.stringify(words, null, 1)}\n`);
  return report;
}

async function planCommand(deps: MotionDependencies, project: string, beatSync: boolean): Promise<string[]> {
  const script = await readScript(deps, project);
  const voDurations = await Promise.all(
    script.scenes.map(async (scene) => wavDurationSec(await deps.readBytes(join(project, 'assets', 'audio', `vo-${scene.id}.wav`)))),
  );
  const musicSource = join(project, 'assets', 'music', script.music.file);
  const onsets = parseHyperframesBeats(await deps.detectBeats(musicSource));
  const roughTotal = voDurations.reduce((sum, d) => sum + d + 4, 0) + 30;
  const grid = fitBeatGrid(onsets, roughTotal);
  const slots = layoutScenes(script.scenes, voDurations, { beatSync, beats: grid.beats });
  const duration = slots.at(-1)?.end ?? 0;
  await deps.trimAudio({ from: musicSource, to: join(project, 'assets', 'audio', 'music.wav'), durationSec: duration + MUSIC_TAIL });
  const timeline: MotionTimeline = {
    beatSync,
    duration,
    bpm: grid.bpm,
    beatLength: grid.period,
    beats: grid.beats.filter((b) => b <= duration),
    scenes: slots,
    musicAutomation: buildDuckAutomation(slots, duration),
    musicCredit: script.music.credit,
  };
  await deps.writeText(join(project, TIMELINE), `${JSON.stringify(timeline, null, 2)}\n`);
  return [
    `plan: ${grid.bpm} BPM (confidence ${grid.confidence}) · beat sync ${beatSync ? 'on' : 'off'} · ${duration} s`,
    ...slots.map((s) => `  ${s.id.padEnd(10)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  voice ${s.voStart.toFixed(2)}+${s.voDuration.toFixed(2)}`),
  ];
}

async function composeCommand(deps: MotionDependencies, project: string): Promise<string[]> {
  const script = await readScript(deps, project);
  const timeline = JSON.parse(await deps.readText(join(project, TIMELINE))) as MotionTimeline;
  const words = JSON.parse(await deps.readText(join(project, WORDS))) as SceneWords;
  const html = composeTemplate(await deps.readText(join(project, 'index.html.tpl')), script, timeline, words);
  await deps.writeText(join(project, 'index.html'), html);
  return [`compose: index.html · ${timeline.scenes.length} scenes · ${timeline.duration} s`];
}

export async function runCli(argv: string[], resolvePath: (raw: string) => string, deps: MotionDependencies): Promise<CliOutcome> {
  try {
    const { positionals, values } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        takes: { type: 'string', default: '5' },
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
        stdout = await initCommand(deps, first, resolvePath(second));
        break;
      case 'voice': {
        const takes = Number(values.takes);
        if (!Number.isInteger(takes) || takes < 1) throw new MotionStudioError('CLI_USAGE', '--takes must be a positive integer');
        stdout = await voiceCommand(deps, project, takes);
        break;
      }
      case 'plan':
        stdout = await planCommand(deps, project, values['beat-sync'] && !values['no-beat-sync']);
        break;
      case 'compose':
        stdout = await composeCommand(deps, project);
        break;
      case 'render': {
        const outPath = values.out ? resolvePath(values.out) : join(project, 'renders', 'video.mp4');
        await deps.render({ projectDir: project, outPath, fps: Number(values.fps), quality: values.quality });
        stdout = [`render: ${outPath}`];
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
