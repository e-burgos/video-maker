import type { AssetId, MediaAsset } from '@video-maker/timeline-core';

import type { Clock } from '../clock';
import { systemClock } from '../clock';
import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { parseFfprobeJson } from './parse-ffprobe-json';

export const FFPROBE_ARGS = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams'] as const;

export interface ProbeMediaOptions {
  assetId?: AssetId;
  probedAt?: string;
  clock?: Clock;
  ffprobePath?: string;
  runOptions?: CommandOptions;
}

export async function probeMedia(
  path: string,
  runner: CommandRunner,
  opts?: ProbeMediaOptions,
): Promise<MediaAsset> {
  const ffprobePath = opts?.ffprobePath ?? 'ffprobe';
  const args = [...FFPROBE_ARGS, path];
  const result = await runner.run(ffprobePath, args, opts?.runOptions);

  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffprobePath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  const probedAt = opts?.probedAt ?? (opts?.clock ?? systemClock).nowIso();

  return parseFfprobeJson(result.stdout, {
    path,
    probedAt,
    ...(opts?.assetId !== undefined ? { assetId: opts.assetId } : {}),
  });
}
