import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';

import type { CommandRunner } from '@video-maker/media-local';

import type { FetchRemotePort, SynthesizeVoicePort } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  ELEVENLABS_WAV_CHANNELS,
  ELEVENLABS_WAV_SAMPLE_RATE,
  synthesizeWithElevenLabs,
} from './elevenlabs-tts';
import type { ElevenLabsFilePorts, ElevenLabsTtsPorts } from './elevenlabs-tts';
import { ELEVENLABS_SECRET_NAME } from './elevenlabs-voice';

export interface NodeElevenLabsSynthesizerConfig {
  readonly fetchRemote: FetchRemotePort;
  readonly readSecret: (name: string) => Promise<string | null>;
  readonly cacheDirectory: string;
  readonly ffmpegPath: () => Promise<string>;
  readonly commandRunner: () => Promise<CommandRunner>;
  readonly appendSilence: (
    inputPath: string,
    outPath: string,
    silenceMs: number,
    ffmpegPath: string,
    runner: CommandRunner,
  ) => Promise<void>;
}

const nodeFiles: ElevenLabsFilePorts = {
  exists: async (path) => {
    try {
      return (await stat(path)).size > 0;
    } catch {
      return false;
    }
  },
  ensureDirectory: async (path) => {
    await mkdir(path, { recursive: true });
  },
  writeBytes: (path, bytes) => writeFile(path, bytes),
  rename,
  copy: copyFile,
  remove: (path) => rm(path, { force: true }),
};

function narrationToSingleLine(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function createNodeElevenLabsSynthesizer(config: NodeElevenLabsSynthesizerConfig): SynthesizeVoicePort {
  return async (input) => {
    const ffmpegPath = await config.ffmpegPath();
    const runner = await config.commandRunner();
    const ports: ElevenLabsTtsPorts = {
      fetchRemote: config.fetchRemote,
      readApiKey: () => config.readSecret(ELEVENLABS_SECRET_NAME),
      cacheDirectory: config.cacheDirectory,
      files: nodeFiles,
      transcodeToWav: async (inputPath, outPath) => {
        const args = [
          '-hide_banner',
          '-nostats',
          '-y',
          '-i',
          inputPath,
          '-ar',
          String(ELEVENLABS_WAV_SAMPLE_RATE),
          '-ac',
          String(ELEVENLABS_WAV_CHANNELS),
          '-c:a',
          'pcm_s16le',
          outPath,
        ];
        const result = await runner.run(ffmpegPath, args, { cwd: input.projectRoot });
        if (result.exitCode !== 0) {
          throw new PipelineStageError({
            code: 'VOICE_SYNTHESIS_FAILED',
            stage: 'synthesize',
            resource: input.voiceId ?? null,
            expected: 'ffmpeg to transcode the ElevenLabs audio to wav',
            hint: result.stderr.slice(-300),
          });
        }
      },
      appendSilence: (inputPath, outPath, silenceMs) =>
        config.appendSilence(inputPath, outPath, silenceMs, ffmpegPath, runner),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    };

    const text = narrationToSingleLine(await readFile(input.textPath, 'utf8'));
    await synthesizeWithElevenLabs(
      {
        voiceId: input.voiceId as string,
        text,
        outPath: input.outPath,
        ...(input.languageCode === undefined ? {} : { languageCode: input.languageCode }),
        ...(input.lengthScale === undefined ? {} : { lengthScale: input.lengthScale }),
        ...(input.noiseScale === undefined ? {} : { noiseScale: input.noiseScale }),
        ...(input.trailingPauseMs === undefined ? {} : { trailingPauseMs: input.trailingPauseMs }),
      },
      ports,
    );
  };
}
