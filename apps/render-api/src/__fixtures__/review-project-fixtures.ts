import type { Timeline } from '@video-maker/timeline-core';

const PROBED_AT = '2026-10-11T00:00:00.000Z';

export const footageTimeline: Timeline = {
  schemaVersion: 1,
  id: 'timeline-demo',
  format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
  durationFrames: 900,
  assets: [
    { id: 'raw/aroll.mp4', kind: 'video', path: 'raw/aroll.mp4', durationMs: 30_000, fps: 30, width: 1920, height: 1080, rotation: 0, hasAudio: false, videoCodec: 'h264', probedAt: PROBED_AT },
    { id: 'raw/music.mp3', kind: 'audio', path: 'raw/music.mp3', durationMs: 120_000, audio: { sampleRate: 44_100, channels: 2, integratedLufs: -12 }, probedAt: PROBED_AT },
    { id: 'work/voice.wav', kind: 'audio', path: 'work/voice.wav', durationMs: 30_000, audio: { sampleRate: 48_000, channels: 1 }, probedAt: PROBED_AT },
    { id: 'raw/logo.png', kind: 'image', path: 'raw/logo.png', durationMs: 0, probedAt: PROBED_AT },
  ],
  tracks: {
    aroll: [{ id: 'aroll-1', assetId: 'raw/aroll.mp4', from: 0, durationFrames: 900, trimStartMs: 0, transform: { scale: 1, translateX: 0, translateY: 0 }, muted: true }],
    broll: [],
    voice: [{ id: 'voice-1', assetId: 'work/voice.wav', from: 0, durationFrames: 900, trimStartMs: 0, gainDb: 0 }],
    music: [{ id: 'music-1', assetId: 'raw/music.mp3', from: 0, durationFrames: 900, trimStartMs: 0, gainDb: -8 }],
    captions: [
      { id: 'caption-1', from: 30, durationFrames: 60, words: [{ text: 'Hola', fromFrame: 0, durationFrames: 30 }, { text: 'mundo', fromFrame: 30, durationFrames: 30 }], box: { x: 60, y: 60, width: 1800, height: 960 } },
    ],
  },
  audioMix: {
    voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
    music: { baseGainDb: -8, duckedGainDb: -18, referenceLufs: -16, attackMs: 150, releaseMs: 400, holdMs: 250 },
    automation: [
      { frame: 0, gainDb: -8 },
      { frame: 28, gainDb: -8 },
      { frame: 32, gainDb: -18 },
      { frame: 212, gainDb: -18 },
      { frame: 224, gainDb: -8 },
      { frame: 400, gainDb: -8 },
      { frame: 402, gainDb: -18 },
    ],
  },
  logo: { assetId: 'raw/logo.png', position: 'bottom-right', widthRatio: 0.2, marginRatio: 0.03, opacity: 1 },
  bumpers: {
    intro: { enabled: true, durationMs: 2000, backgroundColor: '#ffffff', animation: 'zoom', logoWidthRatio: 0.4 },
    outro: { enabled: true, durationMs: 2000, backgroundColor: '#ffffff', animation: 'zoom', logoWidthRatio: 0.4 },
  },
  captionStyle: 'subtle-lower',
};

export const motionTimeline = {
  duration: 12,
  scenes: [
    { id: 'hook', start: 0, end: 5, voStart: 0.25, voDuration: 3 },
    { id: 'cta', start: 5, end: 12, voStart: 5.25, voDuration: 4 },
  ],
  musicAutomation: {
    version: 1,
    lanes: [{ target: 'volume', points: [{ t: 0, v: 0.85 }, { t: 5, v: 0.85 }, { t: 12, v: 0 }] }],
  },
};


export const REVIEW_PROJECT_ROOT = '/media/demo';

export function footageProjectFiles(): Array<{ path: string; contents: string }> {
  return [
    { path: `${REVIEW_PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(footageTimeline) },
    { path: `${REVIEW_PROJECT_ROOT}/raw/aroll.mp4`, contents: 'x' },
    { path: `${REVIEW_PROJECT_ROOT}/raw/music.mp3`, contents: 'x' },
    { path: `${REVIEW_PROJECT_ROOT}/work/voice.wav`, contents: 'x' },
    { path: `${REVIEW_PROJECT_ROOT}/raw/logo.png`, contents: 'x' },
    { path: `${REVIEW_PROJECT_ROOT}/out/demo.mp4`, contents: 'x' },
  ];
}

export function motionProjectFiles(): Array<{ path: string; contents: string }> {
  const work = `${REVIEW_PROJECT_ROOT}/work/motion`;
  return [
    { path: `${work}/timeline.json`, contents: JSON.stringify(motionTimeline) },
    { path: `${work}/assets/audio/vo-hook.wav`, contents: 'x' },
    { path: `${work}/assets/audio/vo-cta.wav`, contents: 'x' },
    { path: `${work}/assets/audio/music.wav`, contents: 'x' },
    { path: `${REVIEW_PROJECT_ROOT}/out/motion.mp4`, contents: 'x' },
  ];
}
