import {
  ALL_TEXT_OVERLAY_VARIANTS,
  MAX_TEXT_OVERLAYS,
  MIN_TEXT_OVERLAY_DURATION_MS,
  TEXT_OVERLAY_KINDS,
  TEXT_OVERLAY_VARIANTS,
} from '@video-maker/timeline-core';
import type { TextOverlay, TextOverlayKind, TextOverlayVariant, Timeline } from '@video-maker/timeline-core';

export const TEXT_OVERLAY_EDITOR_KINDS: readonly TextOverlayKind[] = TEXT_OVERLAY_KINDS;
export const TEXT_OVERLAY_AUTO_VARIANT = 'auto' as const;
export type TextOverlayVariantChoice = typeof TEXT_OVERLAY_AUTO_VARIANT | TextOverlayVariant;
export const DEFAULT_TEXT_OVERLAY_DURATION_MS = 2500;
const TEXT_OVERLAY_GAP_MS = 500;

export type TextOverlayPatch = Partial<Omit<TextOverlay, 'id' | 'kind'>>;

export function textOverlayVariantChoices(kind: TextOverlayKind): readonly TextOverlayVariantChoice[] {
  return [TEXT_OVERLAY_AUTO_VARIANT, ...TEXT_OVERLAY_VARIANTS[kind]];
}

function timelineDurationMs(timeline: Timeline): number {
  return Math.round((timeline.durationFrames / timeline.format.fps) * 1000);
}

function nextOverlayId(overlays: readonly TextOverlay[]): string {
  const used = new Set(overlays.map((overlay) => overlay.id));
  let index = overlays.length + 1;
  while (used.has(`text-${index}`)) {
    index += 1;
  }
  return `text-${index}`;
}

function nextFreeStartMs(overlays: readonly TextOverlay[]): number {
  return overlays.reduce((end, overlay) => Math.max(end, overlay.startMs + overlay.durationMs + TEXT_OVERLAY_GAP_MS), 0);
}

export function canAddTextOverlay(timeline: Timeline): boolean {
  const overlays = timeline.textOverlays ?? [];
  return overlays.length < MAX_TEXT_OVERLAYS && nextFreeStartMs(overlays) + MIN_TEXT_OVERLAY_DURATION_MS <= timelineDurationMs(timeline);
}

export function addTextOverlay(timeline: Timeline, kind: TextOverlayKind, text: string): Timeline {
  const overlays = timeline.textOverlays ?? [];
  const startMs = nextFreeStartMs(overlays);
  const durationMs = Math.max(
    MIN_TEXT_OVERLAY_DURATION_MS,
    Math.min(DEFAULT_TEXT_OVERLAY_DURATION_MS, timelineDurationMs(timeline) - startMs),
  );
  return { ...timeline, textOverlays: [...overlays, { id: nextOverlayId(overlays), kind, startMs, durationMs, text }] };
}

function withoutUndefined(overlay: TextOverlay): TextOverlay {
  return Object.fromEntries(Object.entries(overlay).filter(([, value]) => value !== undefined)) as TextOverlay;
}

export function updateTextOverlay(timeline: Timeline, id: string, patch: TextOverlayPatch): Timeline {
  const overlays = (timeline.textOverlays ?? []).map((overlay) =>
    overlay.id === id ? withoutUndefined({ ...overlay, ...patch }) : overlay,
  );
  return { ...timeline, textOverlays: overlays };
}

export function removeTextOverlay(timeline: Timeline, id: string): Timeline {
  const overlays = (timeline.textOverlays ?? []).filter((overlay) => overlay.id !== id);
  if (overlays.length > 0) {
    return { ...timeline, textOverlays: overlays };
  }
  const next = { ...timeline };
  delete next.textOverlays;
  return next;
}

function isVariant(choice: string): choice is TextOverlayVariant {
  return (ALL_TEXT_OVERLAY_VARIANTS as readonly string[]).includes(choice);
}

export function variantPatch(choice: string): TextOverlayPatch {
  return { variant: isVariant(choice) ? choice : undefined };
}
