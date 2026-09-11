import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { placeSpeechFilterGraph, placeSpeechSegments } from './place-speech-segments';

describe('placeSpeechFilterGraph', () => {
  it('delays every segment to its own absolute start and mixes them without normalization', () => {
    expect(placeSpeechFilterGraph([0, 20_000, 28_000])).toBe(
      '[0:a]anull[s0];[1:a]adelay=20000:all=1[s1];[2:a]adelay=28000:all=1[s2];' +
        '[s0][s1][s2]amix=inputs=3:normalize=0:duration=longest[out]',
    );
  });

  it('does not mix a single segment', () => {
    expect(placeSpeechFilterGraph([1500])).toBe('[0:a]adelay=1500:all=1[s0];[s0]anull[out]');
  });

  it('pads the mix to the total duration the script declared', () => {
    expect(placeSpeechFilterGraph([0, 20_000], 97_000)).toContain(
      'amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=97000ms[out]',
    );
    expect(placeSpeechFilterGraph([0], 97_000)).toContain('anull,apad=whole_dur=97000ms[out]');
  });

  it('rounds a fractional start to whole milliseconds', () => {
    expect(placeSpeechFilterGraph([0, 1200.6])).toContain('adelay=1201:all=1');
  });
});

describe('placeSpeechSegments', () => {
  it('gives ffmpeg one input per segment and writes 48 kHz mono pcm', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await placeSpeechSegments(
      '/p/work/voice/voice.wav',
      {
        segments: [
          { path: '/p/a.wav', startMs: 0 },
          { path: '/p/b.wav', startMs: 20_000 },
        ],
      },
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
      '[0:a]anull[s0];[1:a]adelay=20000:all=1[s1];[s0][s1]amix=inputs=2:normalize=0:duration=longest[out]',
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

  it('honours an explicit sample rate and channel count', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await placeSpeechSegments(
      '/p/out.wav',
      { segments: [{ path: '/p/a.wav', startMs: 0 }], sampleRate: 22_050, channels: 2 },
      runner,
    );

    expect(runner.calls[0]?.args).toContain('22050');
    expect(runner.calls[0]?.args).toContain('2');
  });

  it('propagates a non-zero exit as CommandFailedError', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 1, stderr: 'Invalid argument' } },
    ]);

    await expect(
      placeSpeechSegments('/p/out.wav', { segments: [{ path: '/p/a.wav', startMs: 0 }] }, runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
  });
});
