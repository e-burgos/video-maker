import type { DeliveryContract, SceneFrame } from '@video-maker/timeline-core';

import type { DeliveryPromise } from './review-facts';

export type ReviewMode = 'footage' | 'motion';

export interface SecondsRange {
  readonly startSec: number;
  readonly endSec: number;
}

export interface SfxLevel {
  readonly lufs: number;
  readonly gainDb: number;
}

export interface VoiceSegmentLevels extends SecondsRange {
  readonly voiceLufs: number | null;
  readonly musicLufs: number | null;
  readonly musicGainDb: number;
  readonly sfx?: readonly SfxLevel[];
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

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CaptionPlacement extends SecondsRange {
  readonly id: string;
  readonly text: string;
  readonly rect: PixelRect;
}

export interface OverlayPlacement extends SecondsRange {
  readonly rect: PixelRect;
}

export interface CaptionLayoutFacts {
  readonly captions: readonly CaptionPlacement[];
  readonly logo: PixelRect | null;
  readonly chatButton: PixelRect | null;
  readonly overlays: readonly OverlayPlacement[];
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
  readonly captionLayout?: CaptionLayoutFacts | null;
  readonly blackSegments: readonly SecondsRange[];
  readonly frozenSegments: readonly SecondsRange[];
  readonly silences: readonly SecondsRange[];
  readonly missingAssets: readonly string[];
  readonly sceneFrames: readonly SceneFrame[];
  readonly promise: DeliveryPromise | null;
}
