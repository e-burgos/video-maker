import { createSeededRandom, hashStringToSeed, pickAvoidingPrevious } from '../random/seeded-random';
import { TEXT_OVERLAY_VARIANTS } from '../schemas/timeline.schema';
import type {
  TextOverlay,
  TextOverlayKind,
  TextOverlayPlacement,
  TextOverlayVariant,
  Timeline,
} from '../schemas/timeline.schema';

export interface ResolvedTextOverlay {
  readonly id: string;
  readonly kind: TextOverlayKind;
  readonly variant: TextOverlayVariant;
  readonly placement: TextOverlayPlacement;
  readonly startMs: number;
  readonly durationMs: number;
  readonly text: string;
  readonly subtitle: string | null;
  readonly eyebrow: string | null;
}

export interface TextOverlayTheme {
  readonly fontFamily: string;
  readonly textColor: string;
  readonly accentColor: string;
  readonly plateColor: string;
}

export const DEFAULT_TEXT_OVERLAY_THEME: TextOverlayTheme = {
  fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
  textColor: '#ffffff',
  accentColor: '#38bdf8',
  plateColor: '#0f172a',
};

export const DEFAULT_TEXT_OVERLAY_PLACEMENTS: Readonly<Record<TextOverlayKind, TextOverlayPlacement>> = {
  'lower-third': 'bottom-left',
  'chapter-title': 'top-center',
  'kinetic-text': 'top-center',
};

function variantPool(kind: TextOverlayKind): readonly [TextOverlayVariant, ...TextOverlayVariant[]] {
  return TEXT_OVERLAY_VARIANTS[kind];
}

function byStart(overlays: readonly TextOverlay[]): TextOverlay[] {
  return [...overlays].sort((a, b) => a.startMs - b.startMs);
}

export function resolveTextOverlays(timeline: Pick<Timeline, 'id' | 'textOverlays'>): ResolvedTextOverlay[] {
  const next = createSeededRandom(hashStringToSeed(`text-overlays:${timeline.id}`));
  const previousByKind = new Map<TextOverlayKind, TextOverlayVariant>();
  return byStart(timeline.textOverlays ?? []).map((overlay) => {
    const variant = overlay.variant ?? pickAvoidingPrevious(variantPool(overlay.kind), previousByKind.get(overlay.kind), next);
    previousByKind.set(overlay.kind, variant);
    return {
      id: overlay.id,
      kind: overlay.kind,
      variant,
      placement: overlay.placement ?? DEFAULT_TEXT_OVERLAY_PLACEMENTS[overlay.kind],
      startMs: overlay.startMs,
      durationMs: overlay.durationMs,
      text: overlay.text,
      subtitle: overlay.kind === 'kinetic-text' ? null : (overlay.subtitle ?? null),
      eyebrow: overlay.kind === 'chapter-title' ? (overlay.eyebrow ?? null) : null,
    };
  });
}

export function resolveTextOverlayTheme(timeline: Pick<Timeline, 'captionTheme' | 'bumpers'>): TextOverlayTheme {
  const brand = timeline.captionTheme;
  if (brand !== undefined) {
    return {
      fontFamily: `"${brand.fontFamily}", ${DEFAULT_TEXT_OVERLAY_THEME.fontFamily}`,
      textColor: brand.textColor,
      accentColor: brand.accentColor,
      plateColor: brand.boxColor,
    };
  }
  return { ...DEFAULT_TEXT_OVERLAY_THEME, accentColor: timeline.bumpers?.style?.accentColor ?? DEFAULT_TEXT_OVERLAY_THEME.accentColor };
}
