import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export const DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE = 16000;
export const DEFAULT_EXTRACT_AUDIO_CHANNELS = 1;

export interface ExtractAudioOptions {
  sampleRate?: number;
  channels?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function extractAudioForTranscription(
  path: string,
  out: string,
  runner: CommandRunner,
  opts?: ExtractAudioOptions,
): Promise<string> {
  const sampleRate = opts?.sampleRate ?? DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE;
  const channels = opts?.channels ?? DEFAULT_EXTRACT_AUDIO_CHANNELS;
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    path,
    '-vn',
    '-ac',
    String(channels),
    '-ar',
    String(sampleRate),
    '-c:a',
    'pcm_s16le',
    out,
  ];

  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffmpegPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return out;
}
