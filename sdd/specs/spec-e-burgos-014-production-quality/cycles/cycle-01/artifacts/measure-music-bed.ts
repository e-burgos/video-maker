import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ExecaCommandRunner, mixTimelineAudio, resolveBinaries } from '@video-maker/media-local';
import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

interface Measurement {
  readonly integratedLufs: number;
  readonly truePeakDbfs: number;
  readonly loudnessRangeLu: number;
}

function summaryOf(stderr: string): string {
  const summaryIndex = stderr.lastIndexOf('Summary:');
  return summaryIndex === -1 ? stderr : stderr.slice(summaryIndex);
}

function parseEbur128(stderr: string): Measurement {
  const summary = summaryOf(stderr);
  const integrated = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(summary);
  const peak = /Peak:\s+(-?[\d.]+|-inf)\s+dBFS/.exec(summary);
  const range = /LRA:\s+(-?[\d.]+)\s+LU/.exec(summary);

  return {
    integratedLufs: Number(integrated?.[1] ?? Number.NaN),
    truePeakDbfs: Number(peak?.[1] ?? Number.NaN),
    loudnessRangeLu: Number(range?.[1] ?? Number.NaN),
  };
}

async function measure(path: string, ffmpegPath: string): Promise<Measurement> {
  const runner = new ExecaCommandRunner();
  const result = await runner.run(ffmpegPath, [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-af',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ]);

  return parseEbur128(result.stderr);
}

function readTimeline(projectRoot: string): Timeline {
  return TimelineSchema.parse(
    JSON.parse(readFileSync(resolve(projectRoot, 'work/timeline.json'), 'utf8')),
  );
}

function withoutVoice(timeline: Timeline): Timeline {
  return { ...timeline, tracks: { ...timeline.tracks, voice: [] } };
}

function withoutMusic(timeline: Timeline): Timeline {
  return { ...timeline, tracks: { ...timeline.tracks, music: [] } };
}

async function main(): Promise<void> {
  const projectRoot = process.argv[2];
  const outDir = process.argv[3];
  if (projectRoot === undefined || outDir === undefined) {
    throw new Error('usage: measure-music-bed.ts <project-root> <out-dir>');
  }

  const binaries = await resolveBinaries(process.env);
  const runner = new ExecaCommandRunner();
  const timeline = readTimeline(projectRoot);
  const runOptions = { cwd: projectRoot };

  const targets = [
    { name: 'full-mix', timeline },
    { name: 'music-bed-only', timeline: withoutVoice(timeline) },
    { name: 'voice-only', timeline: withoutMusic(timeline) },
  ];

  for (const target of targets) {
    const outPath = resolve(outDir, `${target.name}.wav`);
    const mix = await mixTimelineAudio(target.timeline, outPath, runner, {
      ffmpegPath: binaries.ffmpeg,
      runOptions,
    });
    const measurement = await measure(outPath, binaries.ffmpeg);

    console.log(
      JSON.stringify({
        target: target.name,
        outPath,
        filterComplex: mix.filterComplex,
        ...measurement,
      }),
    );
  }
}

void main();
