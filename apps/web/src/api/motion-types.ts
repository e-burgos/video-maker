import type { RenderApiErrorPayload, RenderJobState } from './render-api-types';

export const MOTION_FORMATS = ['16:9', '9:16'] as const;

export type MotionFormat = (typeof MOTION_FORMATS)[number];

export type MotionMusicTrack = {
  id: string;
  mood: string;
  bpm: number;
  hasDrop: boolean;
};

export type MotionBrand = {
  id: string;
  name: string;
  source?: 'built-in' | 'user';
  formats: MotionFormat[];
  music: MotionMusicTrack[];
};

export type MotionBriefImage = {
  file: string;
  caption: string;
};

export type MotionBrief = {
  version: 1;
  brand: string;
  title?: string;
  format: MotionFormat;
  beatSync: boolean;
  music: string | null;
  goal?: string;
  audience?: string;
  script: string;
  images: MotionBriefImage[];
};

export type MotionScene = {
  id: string;
  kind: string;
  vo: string;
  chapter?: string;
  anchor?: string;
  props: Record<string, unknown>;
};

export type MotionStoryboardMusic = {
  track: string;
  volume?: number;
};

export type MotionStoryboard = {
  version: number;
  title: string;
  brand: string;
  format: MotionFormat;
  beatSync: boolean;
  music: MotionStoryboardMusic | null;
  scenes: MotionScene[];
};

export type MotionOverviewScene = {
  id: string;
  startSec: number;
  endSec: number;
  voStartSec: number;
  voDurationSec: number;
};

export type MotionOverviewTimeline = {
  durationSec: number;
  bpm: number | null;
  beatSync: boolean;
  musicCredit: string | null;
  scenes: MotionOverviewScene[];
};

export type MotionOverviewVoiceScene = {
  sceneId: string;
  vo: string;
  voicedText: string | null;
  voice: string | null;
  path: string | null;
  durationSec: number | null;
  stale: boolean;
};

export type MotionOverviewVideo = {
  path: string;
  creditsPath: string | null;
  credits: string | null;
  modifiedAt: string;
  outdated: boolean;
};

export type MotionOverview = {
  storyboard: MotionStoryboard | null;
  timeline: MotionOverviewTimeline | null;
  voice: { scenes: MotionOverviewVoiceScene[] } | null;
  video: MotionOverviewVideo | null;
};

export const MOTION_PHASES = ['storyboard', 'video', 'all'] as const;

export type MotionPhase = (typeof MOTION_PHASES)[number];

export const MOTION_STAGES = ['storyboard', 'voice', 'plan', 'compose', 'render'] as const;

export type MotionStage = (typeof MOTION_STAGES)[number];

export type CreateMotionJobInput = {
  phase: MotionPhase;
  output?: string;
  takes?: number;
  overwrite?: boolean;
};

export type MotionJobProgress = {
  stage: MotionStage;
  linesVoiced?: number;
  totalLines?: number;
};

export type MotionStoryboardReport = {
  repaired: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
};

export type MotionJobReport = {
  path: string | null;
  durationSec: number | null;
  scenes: number;
  musicCredit?: string | null;
  storyboard: MotionStoryboardReport | null;
};

export type MotionJob = {
  id: string;
  kind: 'motion';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: MotionJobProgress | null;
  report: MotionJobReport | null;
  error: RenderApiErrorPayload | null;
};
