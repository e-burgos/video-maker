import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { concatSpeechFilterGraph, concatSpeechSegments } from './concat-speech-segments';

describe('concatSpeechFilterGraph', () => {
  it('delays every segment but the first by the gap and concatenates them in order', () => {
    expect(concatSpeechFilterGraph(3, 900)).toBe(
      '[0:a]anull[s0];[1:a]adelay=900:all=1[s1];[2:a]adelay=900:all=1[s2];[s0][s1][s2]concat=n=3:v=0:a=1[out]',
    );
  });

  it('inserts no silence with a zero gap', () => {
    expect(concatSpeechFilterGraph(2, 0)).toBe('[0:a]anull[s0];[1:a]anull[s1];[s0][s1]concat=n=2:v=0:a=1[out]');
  });

  it('handles a single segment', () => {
    expect(concatSpeechFilterGraph(1, 900)).toBe('[0:a]anull[s0];[s0]concat=n=1:v=0:a=1[out]');
  });
});

describe('concatSpeechSegments', () => {
  it('gives ffmpeg one input per segment and writes 48 kHz mono pcm', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await concatSpeechSegments(
      '/p/work/voice/voice.wav',
      { inputPaths: ['/p/a.wav', '/p/b.wav'], gapMs: 900 },
      runner,
    );

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      '/p/a.wav',
      '-i',
      '/p/b.wav',
      '-filter_complex',
      '[0:a]anull[s0];[1:a]adelay=900:all=1[s1];[s0][s1]concat=n=2:v=0:a=1[out]',
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      '/p/work/voice/voice.wav',
    ]);
    expect(result).toBe('/p/work/voice/voice.wav');
  });

  it('propagates a non-zero exit as CommandFailedError', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 1, stderr: 'Invalid argument' } },
    ]);

    await expect(
      concatSpeechSegments('/p/out.wav', { inputPaths: ['/p/a.wav'], gapMs: 0 }, runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
  });
});
