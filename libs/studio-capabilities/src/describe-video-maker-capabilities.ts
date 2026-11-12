import { MONTAGE_PRESETS } from '@video-maker/auto-montage';
import { ANIMATION_NAMES, ICON_NAMES, SCENE_EXITS, SCENE_KINDS, SFX_KINDS, TITLE_STYLES } from '@video-maker/motion-graphics';
import type { SfxBank } from '@video-maker/motion-graphics';
import { PROJECT_MODES } from '@video-maker/local-store';
import {
  ALL_TEXT_OVERLAY_VARIANTS,
  CAPTION_STYLES,
  LOGO_BUMPER_ANIMATIONS,
  LOGO_BUMPER_BACKGROUNDS,
  LOGO_BUMPER_REVEALS,
  LOGO_BUMPER_SFX_KINDS,
  MAX_LOGO_BUMPER_CAPTION_LENGTH,
  MAX_LOGO_BUMPER_DURATION_MS,
  MAX_TEXT_OVERLAYS,
  MAX_TEXT_OVERLAY_TEXT_LENGTH,
  MIN_LOGO_BUMPER_DURATION_MS,
  OUTPUT_PRESETS,
  TEXT_OVERLAY_KINDS,
  TEXT_OVERLAY_PLACEMENTS,
  TEXT_OVERLAY_VARIANTS,
  TimelineTransitionSchema,
} from '@video-maker/timeline-core';

import { ASSET_ROLES } from './asset-roles';
import { BRAND_FILE_KINDS } from './brand-file-kinds';
import { JOB_KINDS_FOR_EXTERNAL_AGENTS } from './job-kinds';

export interface CapabilityVoice {
  readonly id: string;
  readonly label: string;
  readonly engine: string;
  readonly language: string;
  readonly isDefault: boolean;
}

export interface DescribeVideoMakerCapabilitiesInput {
  readonly sfxBank: SfxBank | null;
  readonly voices: readonly CapabilityVoice[];
}

export interface VideoMakerCapabilities {
  readonly projectModes: readonly string[];
  readonly assetRoles: readonly string[];
  readonly brandFileKinds: readonly string[];
  readonly formats: readonly string[];
  readonly jobKinds: readonly string[];
  readonly montage: {
    readonly presets: readonly string[];
    readonly transitions: { readonly kinds: readonly string[]; readonly directions: readonly string[] };
    readonly captionStyles: readonly string[];
  };
  readonly motion: {
    readonly sceneKinds: readonly string[];
    readonly sceneExits: readonly string[];
    readonly titleStyles: readonly string[];
    readonly animations: readonly string[];
    readonly icons: readonly string[];
  };
  readonly bumpers: {
    readonly backgrounds: readonly string[];
    readonly reveals: readonly string[];
    readonly animations: readonly string[];
    readonly sfxKinds: readonly string[];
    readonly durationMs: { readonly min: number; readonly max: number };
    readonly maxCaptionLength: number;
  };
  readonly textOverlays: {
    readonly kinds: readonly string[];
    readonly variantsByKind: Readonly<Record<string, readonly string[]>>;
    readonly variants: readonly string[];
    readonly placements: readonly string[];
    readonly maxPerVideo: number;
    readonly maxTextLength: number;
  };
  readonly sfx: {
    readonly kinds: readonly string[];
    readonly bank: readonly { readonly id: string; readonly kind: string; readonly durationMs: number; readonly peakMs: number }[];
  };
  readonly voices: readonly CapabilityVoice[];
}

function optionsOfOptionalEnum(schema: { unwrap: () => { options: readonly string[] } }): readonly string[] {
  return schema.unwrap().options;
}

export function describeVideoMakerCapabilities(input: DescribeVideoMakerCapabilitiesInput): VideoMakerCapabilities {
  const transitionShape = TimelineTransitionSchema.shape;
  return {
    projectModes: [...PROJECT_MODES],
    assetRoles: [...ASSET_ROLES],
    brandFileKinds: [...BRAND_FILE_KINDS],
    formats: [...OUTPUT_PRESETS],
    jobKinds: [...JOB_KINDS_FOR_EXTERNAL_AGENTS],
    montage: {
      presets: Object.keys(MONTAGE_PRESETS),
      transitions: {
        kinds: [...transitionShape.kind.options],
        directions: [...optionsOfOptionalEnum(transitionShape.direction)],
      },
      captionStyles: [...CAPTION_STYLES],
    },
    motion: {
      sceneKinds: [...SCENE_KINDS],
      sceneExits: [...SCENE_EXITS],
      titleStyles: [...TITLE_STYLES],
      animations: [...ANIMATION_NAMES],
      icons: [...ICON_NAMES],
    },
    bumpers: {
      backgrounds: [...LOGO_BUMPER_BACKGROUNDS],
      reveals: [...LOGO_BUMPER_REVEALS],
      animations: [...LOGO_BUMPER_ANIMATIONS],
      sfxKinds: [...LOGO_BUMPER_SFX_KINDS],
      durationMs: { min: MIN_LOGO_BUMPER_DURATION_MS, max: MAX_LOGO_BUMPER_DURATION_MS },
      maxCaptionLength: MAX_LOGO_BUMPER_CAPTION_LENGTH,
    },
    textOverlays: {
      kinds: [...TEXT_OVERLAY_KINDS],
      variantsByKind: Object.fromEntries(Object.entries(TEXT_OVERLAY_VARIANTS).map(([kind, variants]) => [kind, [...variants]])),
      variants: [...ALL_TEXT_OVERLAY_VARIANTS],
      placements: [...TEXT_OVERLAY_PLACEMENTS],
      maxPerVideo: MAX_TEXT_OVERLAYS,
      maxTextLength: MAX_TEXT_OVERLAY_TEXT_LENGTH,
    },
    sfx: {
      kinds: [...SFX_KINDS],
      bank: (input.sfxBank?.sfx ?? []).map((entry) => ({ id: entry.id, kind: entry.kind, durationMs: entry.durationMs, peakMs: entry.peakMs })),
    },
    voices: [...input.voices],
  };
}
