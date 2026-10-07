import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import {
  ExecaCommandRunner,
  resolveBinaries,
  resolveBinary,
  resolveVoiceBinaries,
  synthesizeSpeech,
  transcribeWithWhisperCpp,
  VOICE_ESPEAK_DATA_DIR_NAME,
  VOICE_TOKENS_FILE_NAME,
  voiceDirectoryName,
} from '@video-maker/media-local';
import type { AssetId } from '@video-maker/timeline-core';

import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionDependencies } from './motion-dependencies';

export const HYPERFRAMES_VERSION = '0.8.139';
const HYPERFRAMES_TIMEOUT_MS = 3 * 60 * 60 * 1000;

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

export function createNodeMotionDependencies(env: NodeJS.ProcessEnv, workspaceRoot: string): MotionDependencies {
  const runner = new ExecaCommandRunner();
  const hyperframes = async (args: string[], cwd: string): Promise<void> => {
    const result = await runner.run('npx', ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`, ...args], { cwd, timeoutMs: HYPERFRAMES_TIMEOUT_MS });
    if (result.exitCode !== 0) {
      throw new MotionStudioError('STAGE_FAILED', `hyperframes ${args[0]} failed: ${result.stderr.slice(-800)}`);
    }
  };

  return {
    templatesRoot: env['MOTION_STUDIO_TEMPLATES'] ?? resolve(workspaceRoot, 'tools', 'motion-studio', 'templates'),
    readText: (path) => readFile(path, 'utf8'),
    readBytes: async (path) => new Uint8Array(await readFile(path)),
    writeText: async (path, content) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    exists,
    copyTree: async (from, to) => {
      await mkdir(to, { recursive: true });
      await cp(from, to, { recursive: true });
    },
    copyFile: async (from, to) => {
      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);
    },
    removeFile: (path) => rm(path, { force: true }),
    synthesize: async ({ text, voice, lengthScale, outPath }) => {
      const { ttsCli, ttsVoicesDir } = await resolveVoiceBinaries(env);
      const voiceDir = join(ttsVoicesDir, voiceDirectoryName(voice));
      const ownData = join(voiceDir, VOICE_ESPEAK_DATA_DIR_NAME);
      const textPath = join(await mkdtemp(join(tmpdir(), 'motion-voice-')), 'line.txt');
      await writeFile(textPath, text);
      await mkdir(dirname(outPath), { recursive: true });
      await synthesizeSpeech(
        outPath,
        {
          modelPath: join(voiceDir, `${voice}.onnx`),
          tokensPath: join(voiceDir, VOICE_TOKENS_FILE_NAME),
          dataDirPath: (await exists(ownData)) ? ownData : join(ttsVoicesDir, VOICE_ESPEAK_DATA_DIR_NAME),
          textPath,
          lengthScale,
          ttsPath: ttsCli,
        },
        runner,
      );
    },
    transcribe: async (wavPath) => {
      const { whisperCli, whisperModel } = await resolveBinaries(env);
      const transcription = await transcribeWithWhisperCpp(
        wavPath,
        {
          modelPath: whisperModel,
          outBase: join(await mkdtemp(join(tmpdir(), 'motion-whisper-')), 'take'),
          assetId: basename(wavPath) as AssetId,
          language: 'es',
          whisperPath: whisperCli,
        },
        runner,
      );
      return {
        text: transcription.words.map((word) => word.text).join(' '),
        words: transcription.words.map((word) => ({ text: word.text, start: word.startMs / 1000, end: word.endMs / 1000 })),
      };
    },
    detectBeats: async (musicPath) => {
      const dir = await mkdtemp(join(tmpdir(), 'motion-beats-'));
      await copyFile(musicPath, join(dir, 'music.mp3'));
      await writeFile(
        join(dir, 'index.html'),
        '<!doctype html><html><body><div id="root" data-composition-id="beats" data-start="0" data-width="1920" data-height="1080" data-duration="1"><audio id="music" src="music.mp3" data-start="0"></audio></div></body></html>',
      );
      await hyperframes(['beats', '.', '--json'], dir);
      return readFile(join(dir, 'beats', 'music.mp3.json'), 'utf8');
    },
    trimAudio: async ({ from, to, durationSec }) => {
      const ffmpeg = await resolveBinary('ffmpeg', env);
      await mkdir(dirname(to), { recursive: true });
      const result = await runner.run(ffmpeg, ['-v', 'error', '-y', '-i', from, '-t', String(durationSec), '-ar', '48000', to]);
      if (result.exitCode !== 0) throw new MotionStudioError('STAGE_FAILED', `ffmpeg trim failed: ${result.stderr.slice(-400)}`);
    },
    render: async ({ projectDir, outPath, fps, quality }) => {
      await hyperframes(['lint'], projectDir);
      await hyperframes(['render', '-f', String(fps), '-q', quality, '-o', outPath], projectDir);
    },
  };
}
