import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import {
  DEFAULT_CONCAT_SPEECH_CHANNELS,
  DEFAULT_CONCAT_SPEECH_SAMPLE_RATE,
} from './concat-speech-segments';

export interface SpeechSegmentPlacement {
  path: string;
  startMs: number;
}

export interface PlaceSpeechSegmentsOptions {
  segments: readonly SpeechSegmentPlacement[];
  totalMs?: number;
  sampleRate?: number;
  channels?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function placeSpeechFilterGraph(startsMs: readonly number[], totalMs?: number): string {
  const labels: string[] = [];
  const chains: string[] = [];

  startsMs.forEach((startMs, index) => {
    const label = `s${index}`;
    labels.push(`[${label}]`);
    chains.push(
      startMs === 0
        ? `[${index}:a]anull[${label}]`
        : `[${index}:a]adelay=${Math.round(startMs)}:all=1[${label}]`,
    );
  });

  const mixFilter =
    startsMs.length === 1
      ? 'anull'
      : `amix=inputs=${startsMs.length}:normalize=0:duration=longest`;
  const padFilter = totalMs === undefined ? '' : `,apad=whole_dur=${Math.round(totalMs)}ms`;

  return `${chains.join(';')};${labels.join('')}${mixFilter}${padFilter}[out]`;
}

export async function placeSpeechSegments(
  outPath: string,
  opts: PlaceSpeechSegmentsOptions,
  runner: CommandRunner,
): Promise<string> {
  const sampleRate = opts.sampleRate ?? DEFAULT_CONCAT_SPEECH_SAMPLE_RATE;
  const channels = opts.channels ?? DEFAULT_CONCAT_SPEECH_CHANNELS;
  const ffmpegPath = opts.ffmpegPath ?? 'ffmpeg';

  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    ...opts.segments.flatMap((segment) => ['-i', segment.path]),
    '-filter_complex',
    placeSpeechFilterGraph(
      opts.segments.map((segment) => segment.startMs),
      opts.totalMs,
    ),
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
