import type { DeliveryContract } from '@video-maker/timeline-core';

export type ReviewMode = 'footage' | 'motion';

export interface SecondsRange {
  readonly startSec: number;
  readonly endSec: number;
}

export interface VoiceSegmentLevels extends SecondsRange {
  readonly voiceLufs: number | null;
  readonly musicLufs: number | null;
  readonly musicGainDb: number;
}

export interface ReviewCaption extends SecondsRange {
  readonly id: string;
  readonly text: string;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
}

export interface ReviewFrame {
  readonly width: number;
  readonly height: number;
  readonly safeZone: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
}

export interface ReviewMasterLevels {
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
}

export interface ReviewInputs {
  readonly file: string;
  readonly mode: ReviewMode;
  readonly createdAt: string;
  readonly delivery: DeliveryContract;
  readonly fps: number;
  readonly expectedDurationSec: number;
  readonly actualDurationSec: number;
  readonly master: ReviewMasterLevels;
  readonly bumpers: readonly SecondsRange[];
  readonly voiceSegments: readonly VoiceSegmentLevels[];
  readonly hasVoice: boolean;
  readonly captionStyle: string | null;
  readonly captions: readonly ReviewCaption[];
  readonly frame: ReviewFrame | null;
  readonly blackSegments: readonly SecondsRange[];
  readonly frozenSegments: readonly SecondsRange[];
  readonly silences: readonly SecondsRange[];
  readonly missingAssets: readonly string[];
}
