import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export const DEFAULT_CONCAT_SPEECH_SAMPLE_RATE = 48000;
export const DEFAULT_CONCAT_SPEECH_CHANNELS = 1;

export interface ConcatSpeechSegmentsOptions {
  inputPaths: readonly string[];
  gapMs: number;
  sampleRate?: number;
  channels?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function concatSpeechFilterGraph(segmentCount: number, gapMs: number): string {
  const labels: string[] = [];
  const chains: string[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const label = `s${index}`;
    labels.push(`[${label}]`);
    chains.push(
      index === 0 || gapMs === 0
        ? `[${index}:a]anull[${label}]`
        : `[${index}:a]adelay=${gapMs}:all=1[${label}]`,
    );
  }

  return `${chains.join(';')};${labels.join('')}concat=n=${segmentCount}:v=0:a=1[out]`;
}

export async function concatSpeechSegments(
  outPath: string,
  opts: ConcatSpeechSegmentsOptions,
  runner: CommandRunner,
): Promise<string> {
  const sampleRate = opts.sampleRate ?? DEFAULT_CONCAT_SPEECH_SAMPLE_RATE;
  const channels = opts.channels ?? DEFAULT_CONCAT_SPEECH_CHANNELS;
  const ffmpegPath = opts.ffmpegPath ?? 'ffmpeg';

  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    ...opts.inputPaths.flatMap((path) => ['-i', path]),
    '-filter_complex',
    concatSpeechFilterGraph(opts.inputPaths.length, opts.gapMs),
    '-map',
    '[out]',
    '-ac',
    String(channels),
    '-ar',
    String(sampleRate),
    '-c:a',
    'pcm_s16le',
    outPath,
  ];

  const result = await runner.run(ffmpegPath, args, opts.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffmpegPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return outPath;
}
