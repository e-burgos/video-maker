import type { DeliveryContract } from '@video-maker/timeline-core';

import type { LevelPlan } from './level-plan';
import type { ReviewCaption, ReviewFrame, SecondsRange } from './review-inputs';

export interface ReviewScene {
  readonly id: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly voice: string | null;
}

export interface DeliveryPromise {
  readonly conceptId: string;
  readonly title: string;
  readonly durationSec: number;
  readonly maxDurationSec: number | null;
}

export interface ReviewFacts {
  readonly explicitDelivery: DeliveryContract | undefined;
  readonly dimensions: { readonly width: number; readonly height: number } | null;
  readonly fps: number;
  readonly expectedDurationSec: number;
  readonly bumpers: readonly SecondsRange[];
  readonly bumperOffsetSec: number;
  readonly levelPlans: readonly LevelPlan[];
  readonly hasVoice: boolean;
  readonly captionStyle: string | null;
  readonly captions: readonly ReviewCaption[];
  readonly frame: ReviewFrame | null;
  readonly missingAssets: readonly string[];
  readonly scenes: readonly ReviewScene[];
  readonly promise: DeliveryPromise | null;
}

export interface ReviewStoragePort {
  readonly stat: (path: string) => Promise<{ readonly kind: 'file' | 'directory' } | null>;
  readonly readTextFile: (path: string) => Promise<string>;
  readonly ensureDirectory: (path: string) => Promise<void>;
}

export async function fileExists(storage: ReviewStoragePort, path: string): Promise<boolean> {
  return (await storage.stat(path))?.kind === 'file';
}
