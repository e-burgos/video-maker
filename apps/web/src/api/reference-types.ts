import type { ReferenceBrief } from '@video-maker/timeline-core';

import type { RenderApiErrorPayload, RenderJobState } from './render-api-types';

export type { ReferenceBrief };

export const REFERENCE_STAGES = ['probe', 'scenes', 'transcribe', 'keyframes', 'persist'] as const;

export type ReferenceStage = (typeof REFERENCE_STAGES)[number];

export function isReferenceStage(value: unknown): value is ReferenceStage {
  return typeof value === 'string' && (REFERENCE_STAGES as readonly string[]).includes(value);
}

export type ReferenceSummary = {
  name: string;
  file: string;
  briefFile: string;
  durationSec: number;
  scenes: number;
  cutsPerMinute: number;
  hasVoice: boolean;
  summary: string;
  createdAt: string;
};

export type ReferenceJobProgress = {
  stage: ReferenceStage;
  percent: number | null;
};

export type ReferenceJobReport = {
  file: string;
  name: string;
  briefFile: string;
  durationSec: number;
  scenes: number;
  cutsPerMinute: number;
  hasVoice: boolean;
};

export type ReferenceJob = {
  id: string;
  kind: 'reference';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: ReferenceJobProgress | null;
  report: ReferenceJobReport | null;
  error: RenderApiErrorPayload | null;
};
