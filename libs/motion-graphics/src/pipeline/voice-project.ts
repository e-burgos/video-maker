import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionScript } from '../script/motion-script';
import type { SceneWords } from '../template/motion-timeline';
import { pickBestTake } from '../voice/pick-best-take';
import { wavDurationSec } from '../voice/wav-duration';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { readExistingWords, readScript, toJson, WORDS_FILE } from './project-files';

export interface VoiceProjectOptions {
  takes: number;
  only?: string[] | undefined;
  onLine?: (line: VoicedLine) => void;
}

export interface VoicedLine {
  sceneId: string;
  take: number;
  attempts: number;
  score: number;
  heard: string;
  done: number;
  total: number;
}

export interface VoiceProjectResult {
  lines: string[];
  voiced: VoicedLine[];
}

function scenesToVoice(script: MotionScript, only: string[] | undefined): MotionScript['scenes'] {
  if (only === undefined) return script.scenes;
  const known = new Set(script.scenes.map((scene) => scene.id));
  const unknown = only.find((id) => !known.has(id));
  if (unknown !== undefined) throw new MotionStudioError('CLI_USAGE', `--only: unknown scene "${unknown}"`);
  return script.scenes.filter((scene) => only.includes(scene.id));
}

export async function voiceProject(ports: MotionPipelinePorts, project: string, options: VoiceProjectOptions): Promise<VoiceProjectResult> {
  const script = await readScript(ports, project);
  const scenes = scenesToVoice(script, options.only);
  const words: SceneWords = options.only === undefined ? {} : await readExistingWords(ports, project);
  const voiced: VoicedLine[] = [];
  for (const scene of scenes) {
    const finalPath = joinPath(project, 'assets', 'audio', `vo-${scene.id}.wav`);
    const { best, attempts } = await pickBestTake(
      scene.vo,
      {
        synthesizeTake: async (take) => {
          const path = joinPath(project, 'assets', 'audio', `vo-${scene.id}.take${take}.wav`);
          await ports.synthesize({ text: scene.vo, voice: script.voice, lengthScale: script.lengthScale, outPath: path });
          return { path, durationSec: wavDurationSec(await ports.readBytes(path)) };
        },
        transcribeTake: (path) => ports.transcribe(path),
      },
      { takes: options.takes },
    );
    await ports.copyFile(best.path, finalPath);
    for (const attempt of attempts) await ports.removeFile(attempt.path);
    words[scene.id] = best.transcript.words.map((w) => ({ w: w.text, t: w.start, e: w.end }));
    const line: VoicedLine = {
      sceneId: scene.id,
      take: best.take + 1,
      attempts: attempts.length,
      score: best.score,
      heard: best.transcript.text,
      done: voiced.length + 1,
      total: scenes.length,
    };
    voiced.push(line);
    options.onLine?.(line);
  }
  await ports.writeText(joinPath(project, WORDS_FILE), toJson(words, 1));
  return { lines: voiced.map((l) => `voice ${l.sceneId}: take ${l.take}/${l.attempts} · ${l.score} · ${l.heard}`), voiced };
}
