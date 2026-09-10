import { describe, expect, it } from 'vitest';

import { canGenerateMontage, montageBlockers } from './montage-capability';
import type { ServiceHealth } from './render-api-types';

function health(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T10:00:00.000Z',
    engine: [
      { name: 'media-local', loaded: true },
      { name: 'composition-remotion/render', loaded: true },
    ],
    binaries: [
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
      { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
      { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
    ],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

describe('montageBlockers', () => {
  it('is empty when the queue is exposed and the four binaries resolve', () => {
    expect(montageBlockers(health())).toEqual([]);
    expect(canGenerateMontage(health())).toBe(true);
  });

  it('blocks when the health has not been read yet', () => {
    expect(montageBlockers(null)).toEqual([
      'The render service health is unknown, so the montage cannot be started.',
    ]);
    expect(canGenerateMontage(null)).toBe(false);
  });

  it('blocks when the service exposes no montage queue', () => {
    const blockers = montageBlockers(
      health({
        capabilities: {
          renderPipeline: true,
          assetStore: true,
          jobQueue: true,
          montageQueue: false,
          storyboardQueue: true,
          voiceQueue: true,
        },
      }),
    );

    expect(blockers).toEqual(['The render service does not expose a montage queue.']);
  });

  it('names the unresolved binary with its env var, never a host path', () => {
    const blockers = montageBlockers(
      health({
        status: 'degraded',
        binaries: [
          { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
          { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
          { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
          { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: false },
        ],
      }),
    );

    expect(blockers).toEqual(['whisperModel is not resolved (WHISPER_MODEL_PATH).']);
    expect(canGenerateMontage(null)).toBe(false);
  });

  it('ignores a binary the montage does not need', () => {
    const blockers = montageBlockers(
      health({
        status: 'degraded',
        binaries: [
          { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
          { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
          { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
          { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
          { name: 'chromium', envVar: 'CHROMIUM_PATH', resolved: false },
        ],
      }),
    );

    expect(blockers).toEqual([]);
  });

  it('reports every blocker at once, so one fix does not hide the next', () => {
    const blockers = montageBlockers(
      health({
        status: 'degraded',
        capabilities: {
          renderPipeline: true,
          assetStore: true,
          jobQueue: true,
          montageQueue: false,
          storyboardQueue: true,
          voiceQueue: true,
        },
        binaries: [
          { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
          { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
          { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: false },
          { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: false },
        ],
      }),
    );

    expect(blockers).toHaveLength(3);
  });
});
