import { describe, expect, it } from 'vitest';

import { readFixture } from '../__fixtures__/load-fixture';
import { CommandFailedError } from '../errors/command-failed-error';
import { MissingMediaStreamError } from '../errors/missing-media-stream-error';
import { FFPROBE_ARGS } from '../ffprobe/probe-media';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { MUX_AUDIO_BITRATE, MUX_AUDIO_CODEC, muxAudioIntoVideo } from './mux-audio-into-video';

const videoRotatedRaw = readFixture('ffprobe/video-rotated.json');
const audioOnlyRaw = readFixture('ffprobe/audio.json');

function runnerFor(probeStdout: string): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: probeStdout, exitCode: 0 } },
    { bin: 'ffmpeg', response: { stdout: '', stderr: '', exitCode: 0 } },
  ]);
}

describe('muxAudioIntoVideo (RF-2-03, CA-010)', () => {
  it('verifica el stream de video con probeMedia antes de invocar ffmpeg (D-16)', async () => {
    const runner = runnerFor(videoRotatedRaw);

    await muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner);

    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]?.bin).toBe('ffprobe');
    expect(runner.calls[0]?.args).toEqual([...FFPROBE_ARGS, '/in/video.mp4']);
    expect(runner.calls[1]?.bin).toBe('ffmpeg');
  });

  it('produce los argumentos exactos de §8.2, con -c:v copy (RN-7)', async () => {
    const runner = runnerFor(videoRotatedRaw);

    const result = await muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner);

    expect(result.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      '/in/video.mp4',
      '-i',
      '/in/audio.wav',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      MUX_AUDIO_CODEC,
      '-b:a',
      MUX_AUDIO_BITRATE,
      '-shortest',
      '/out/final.mp4',
    ]);
    expect(runner.calls[1]?.args).toEqual(result.args);
    expect(result.args).toContain('copy');
    expect(result.outputPath).toBe('/out/final.mp4');
  });

  it('el video nunca se reencodea: -c:v copy es innegociable', async () => {
    const runner = runnerFor(videoRotatedRaw);

    const result = await muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner);

    const codecIndex = result.args.indexOf('-c:v');
    expect(result.args[codecIndex + 1]).toBe('copy');
  });

  it('CE-3: un video sin stream de video lanza MissingMediaStreamError antes de invocar ffmpeg (D-16)', async () => {
    const runner = runnerFor(audioOnlyRaw);

    await expect(
      muxAudioIntoVideo('/in/not-a-video.wav', '/in/audio.wav', '/out/final.mp4', runner),
    ).rejects.toBeInstanceOf(MissingMediaStreamError);

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.bin).toBe('ffprobe');
  });

  it('el MissingMediaStreamError lleva stream: video y el path del video de entrada', async () => {
    const runner = runnerFor(audioOnlyRaw);

    try {
      await muxAudioIntoVideo('/in/not-a-video.wav', '/in/audio.wav', '/out/final.mp4', runner);
      expect.unreachable('se esperaba que muxAudioIntoVideo rechazara');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingMediaStreamError);
      expect((error as MissingMediaStreamError).stream).toBe('video');
      expect((error as MissingMediaStreamError).path).toBe('/in/not-a-video.wav');
    }
  });

  it('propaga CommandFailedError cuando ffprobe falla, sin llegar a invocar ffmpeg', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffprobe', response: { exitCode: 1, stderr: 'boom' } }]);

    await expect(
      muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
    expect(runner.calls).toHaveLength(1);
  });

  it('propaga CommandFailedError cuando ffmpeg falla', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', response: { stdout: videoRotatedRaw, exitCode: 0 } },
      { bin: 'ffmpeg', response: { stderr: 'disk full', exitCode: 1 } },
    ]);

    await expect(
      muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
    expect(runner.calls).toHaveLength(2);
  });

  it('respeta ffmpegPath, ffprobePath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffprobe', response: { stdout: videoRotatedRaw, exitCode: 0 } },
      { bin: '/opt/homebrew/bin/ffmpeg', response: { stdout: '', stderr: '', exitCode: 0 } },
    ]);

    await muxAudioIntoVideo('/in/video.mp4', '/in/audio.wav', '/out/final.mp4', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      ffprobePath: '/opt/homebrew/bin/ffprobe',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffprobe');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
    expect(runner.calls[1]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[1]?.opts).toEqual({ timeoutMs: 5000 });
  });
});
