import { describe, expect, it } from 'vitest';

import type { AssetProbeSummary } from './propose-asset-role';
import { proposeAssetRole } from './propose-asset-role';

interface Case {
  readonly name: string;
  readonly probe: AssetProbeSummary;
  readonly fileName: string;
  readonly role: string;
  readonly reason: string;
}

const CASES: readonly Case[] = [
  {
    name: 'a screen recording with an audio stream is a-roll',
    probe: { kind: 'video', durationMs: 60_000, hasAudio: true },
    fileName: 'screen-recording.mp4',
    role: 'aroll',
    reason: 'has-audio',
  },
  {
    name: 'a silent video is b-roll',
    probe: { kind: 'video', durationMs: 10_000, hasAudio: false },
    fileName: 'drone-shot.mov',
    role: 'broll',
    reason: 'no-audio',
  },
  {
    name: 'a video with no reported audio stream defaults to b-roll',
    probe: { kind: 'video', durationMs: 10_000 },
    fileName: 'clip.mp4',
    role: 'broll',
    reason: 'no-audio',
  },
  {
    name: 'a PNG with an alpha channel is a logo',
    probe: { kind: 'image', durationMs: 0, hasAlpha: true },
    fileName: 'brand-mark.png',
    role: 'logo',
    reason: 'alpha-channel',
  },
  {
    name: 'a JPEG without alpha is a plain image',
    probe: { kind: 'image', durationMs: 0, hasAlpha: false },
    fileName: 'photo.jpg',
    role: 'image',
    reason: 'image',
  },
  {
    name: 'an image with no reported alpha defaults to a plain image',
    probe: { kind: 'image', durationMs: 0 },
    fileName: 'photo.jpg',
    role: 'image',
    reason: 'image',
  },
  {
    name: 'an audio file named with a voice hint is voice regardless of duration',
    probe: { kind: 'audio', durationMs: 120_000 },
    fileName: 'voice-over-final.wav',
    role: 'voice',
    reason: 'voice-name-hint',
  },
  {
    name: 'an audio file named with a Spanish voice hint is voice',
    probe: { kind: 'audio', durationMs: 5_000 },
    fileName: 'locucion-intro.wav',
    role: 'voice',
    reason: 'voice-name-hint',
  },
  {
    name: 'an audio file named with a music hint is audio even if short',
    probe: { kind: 'audio', durationMs: 5_000 },
    fileName: 'bgm-loop.mp3',
    role: 'audio',
    reason: 'music-name-hint',
  },
  {
    name: 'a long audio file with no name hint is music/audio',
    probe: { kind: 'audio', durationMs: 60_000 },
    fileName: 'recording01.wav',
    role: 'audio',
    reason: 'long-audio',
  },
  {
    name: 'a short audio file with no name hint is voice',
    probe: { kind: 'audio', durationMs: 5_000 },
    fileName: 'clip01.wav',
    role: 'voice',
    reason: 'short-audio',
  },
  {
    name: 'an audio file exactly at the long-audio threshold stays voice',
    probe: { kind: 'audio', durationMs: 45_000 },
    fileName: 'clip02.wav',
    role: 'voice',
    reason: 'short-audio',
  },
  {
    name: 'an audio file one millisecond over the threshold becomes audio',
    probe: { kind: 'audio', durationMs: 45_001 },
    fileName: 'clip03.wav',
    role: 'audio',
    reason: 'long-audio',
  },
  {
    name: 'the voice hint check is case-insensitive',
    probe: { kind: 'audio', durationMs: 60_000 },
    fileName: 'VOICE-Take3.WAV',
    role: 'voice',
    reason: 'voice-name-hint',
  },
];

describe('proposeAssetRole', () => {
  it.each(CASES)('$name', ({ probe, fileName, role, reason }) => {
    expect(proposeAssetRole(probe, fileName)).toEqual({ role, reason });
  });
});
