import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import {
  DEFAULT_EXTRACT_AUDIO_CHANNELS,
  DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE,
  extractAudioForTranscription,
} from './extract-audio';

describe('extractAudioForTranscription', () => {
  it('llama a ffmpeg con los argumentos exactos de la tabla usando los defaults', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
    ]);

    const result = await extractAudioForTranscription('input.mp4', 'output.wav', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      'input.mp4',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      'output.wav',
    ]);
    expect(result).toBe('output.wav');
  });

  it('usa los defaults exportados para sampleRate y channels', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await extractAudioForTranscription('input.mp4', 'output.wav', runner);

    expect(runner.calls[0]?.args[7]).toBe(String(DEFAULT_EXTRACT_AUDIO_CHANNELS));
    expect(runner.calls[0]?.args[9]).toBe(String(DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE));
  });

  it('respeta sampleRate y channels no default', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await extractAudioForTranscription('input.mp4', 'output.wav', runner, {
      sampleRate: 44100,
      channels: 2,
    });

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      'input.mp4',
      '-vn',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-c:a',
      'pcm_s16le',
      'output.wav',
    ]);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffmpeg', response: { exitCode: 0 } },
    ]);

    await extractAudioForTranscription('input.mp4', 'output.wav', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });

  it('propaga CommandFailedError con stderr truncado cuando ffmpeg falla', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found when processing input', exitCode: 1 } },
    ]);

    const failure = extractAudioForTranscription('input.mp4', 'output.wav', runner);

    await expect(failure).rejects.toBeInstanceOf(CommandFailedError);
    await expect(failure).rejects.toMatchObject({
      command: 'ffmpeg',
      exitCode: 1,
      stderr: 'Invalid data found when processing input',
      stderrTruncated: false,
    });
  });

  it('no ejecuta ningun binario real: el unico I/O es el FixtureCommandRunner', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await extractAudioForTranscription('input.mp4', 'output.wav', runner);

    expect(runner.calls).toHaveLength(1);
  });
});
