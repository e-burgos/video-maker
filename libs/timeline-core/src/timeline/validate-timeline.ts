import type { z } from 'zod';

import type { MediaAsset } from '../schemas/media-asset.schema';
import type { OutputFormat, SafeZone } from '../schemas/output-format.schema';
import type {
  CaptionClip,
  CaptionClipBox,
  SceneClip,
  Timeline,
  TimelineTransition,
} from '../schemas/timeline.schema';
import { TimelineSchema } from '../schemas/timeline.schema';
import type { AssetId, ClipId, Fps, Frame, Ms } from '../types/units';
import { safeZoneFor } from '../format/format';
import { framesToMs } from '../units/units';

export type TimelineIssueCode =
  | 'SCHEMA_INVALID'
  | 'EMPTY_AROLL'
  | 'ASSET_NOT_FOUND'
  | 'CLIP_EXCEEDS_ASSET'
  | 'AROLL_OVERLAP'
  | 'AROLL_GAP'
  | 'DURATION_MISMATCH'
  | 'CLIP_OUT_OF_TIMELINE'
  | 'TRANSITION_CLIP_NOT_FOUND'
  | 'CAPTION_OUT_OF_SAFE_ZONE'
  | 'SCENES_AND_AROLL'
  | 'SCENE_ASSET_NOT_FOUND'
  | 'SCENE_OVERLAP'
  | 'SCENE_GAP';

export interface TimelineIssue {
  code: TimelineIssueCode;
  path: string;
  message: string;
}

export type TimelineValidationResult = { ok: true } | { ok: false; issues: TimelineIssue[] };

const ASSET_BACKED_TRACK_NAMES = ['aroll', 'broll', 'voice', 'music'] as const;
type AssetBackedTrackName = (typeof ASSET_BACKED_TRACK_NAMES)[number];

interface AssetBackedClip {
  readonly id: ClipId;
  readonly assetId: AssetId;
  readonly from: Frame;
  readonly durationFrames: Frame;
  readonly trimStartMs: Ms;
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') {
      return `${formatted}[${segment}]`;
    }
    const segmentText = String(segment);
    return formatted.length === 0 ? segmentText : `${formatted}.${segmentText}`;
  }, '');
}

function schemaInvalidIssues(error: z.ZodError): TimelineIssue[] {
  return error.issues.map((issue) => ({
    code: 'SCHEMA_INVALID',
    path: formatIssuePath(issue.path),
    message: issue.message,
  }));
}

function clipPath(trackName: AssetBackedTrackName, index: number, field: string): string {
  return `tracks.${trackName}[${index}].${field}`;
}

function assetNotFoundIssue(
  trackName: AssetBackedTrackName,
  index: number,
  clip: AssetBackedClip,
): TimelineIssue {
  return {
    code: 'ASSET_NOT_FOUND',
    path: clipPath(trackName, index, 'assetId'),
    message: `El clip "${clip.id}" referencia el asset "${clip.assetId}", que no existe en assets.`,
  };
}

function clipExceedsAssetUsage(clip: AssetBackedClip, asset: MediaAsset, fps: Fps): boolean {
  if (asset.kind === 'image') {
    return false;
  }
  const usedMs = clip.trimStartMs + framesToMs(clip.durationFrames, fps, 'ceil');
  return usedMs > asset.durationMs;
}

function clipExceedsAssetIssue(
  trackName: AssetBackedTrackName,
  index: number,
  clip: AssetBackedClip,
  asset: MediaAsset,
): TimelineIssue {
  return {
    code: 'CLIP_EXCEEDS_ASSET',
    path: clipPath(trackName, index, 'durationFrames'),
    message: `El clip "${clip.id}" excede la duración del asset "${asset.id}".`,
  };
}

function clipOutOfTimelineRange(clip: AssetBackedClip, durationFrames: Frame): boolean {
  return clip.from < 0 || clip.from + clip.durationFrames > durationFrames;
}

function clipOutOfTimelineIssue(
  trackName: AssetBackedTrackName,
  index: number,
  clip: AssetBackedClip,
  durationFrames: Frame,
): TimelineIssue {
  return {
    code: 'CLIP_OUT_OF_TIMELINE',
    path: clipPath(trackName, index, 'from'),
    message: `El clip "${clip.id}" queda fuera del rango [0, ${durationFrames}) de la Timeline.`,
  };
}

function collectAssetBackedTrackIssues(
  timeline: Timeline,
  assetsById: ReadonlyMap<AssetId, MediaAsset>,
): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const fps = timeline.format.fps;

  for (const trackName of ASSET_BACKED_TRACK_NAMES) {
    const track: readonly AssetBackedClip[] = timeline.tracks[trackName];
    track.forEach((clip, index) => {
      const asset = assetsById.get(clip.assetId);
      if (asset === undefined) {
        issues.push(assetNotFoundIssue(trackName, index, clip));
      } else if (clipExceedsAssetUsage(clip, asset, fps)) {
        issues.push(clipExceedsAssetIssue(trackName, index, clip, asset));
      }

      if (clipOutOfTimelineRange(clip, timeline.durationFrames)) {
        issues.push(clipOutOfTimelineIssue(trackName, index, clip, timeline.durationFrames));
      }
    });
  }

  return issues;
}

function emptyArollIssue(): TimelineIssue {
  return {
    code: 'EMPTY_AROLL',
    path: 'tracks.aroll',
    message: 'La Timeline no tiene ningún clip de A-roll.',
  };
}

function transitionFramesBetween(
  transitions: readonly TimelineTransition[],
  outgoingClipId: ClipId,
  incomingClipId: ClipId,
): Frame {
  const transition = transitions.find(
    (candidate) =>
      candidate.betweenClipIds[0] === outgoingClipId && candidate.betweenClipIds[1] === incomingClipId,
  );
  return transition?.durationFrames ?? 0;
}

function arollOverlapIssue(index: number, clip: { readonly id: ClipId }): TimelineIssue {
  return {
    code: 'AROLL_OVERLAP',
    path: clipPath('aroll', index, 'from'),
    message: `El clip de A-roll "${clip.id}" se solapa con el anterior sin una transición que lo justifique.`,
  };
}

function arollGapIssue(index: number, clip: { readonly id: ClipId }): TimelineIssue {
  return {
    code: 'AROLL_GAP',
    path: clipPath('aroll', index, 'from'),
    message: `Hay un hueco de A-roll antes del clip "${clip.id}".`,
  };
}

function durationMismatchIssue(lastClip: { readonly id: ClipId }, durationFrames: Frame): TimelineIssue {
  return {
    code: 'DURATION_MISMATCH',
    path: 'durationFrames',
    message: `durationFrames (${durationFrames}) no coincide con el final del último clip de A-roll "${lastClip.id}".`,
  };
}

interface PrimaryVisualClip {
  readonly id: ClipId;
  readonly from: Frame;
  readonly durationFrames: Frame;
}

interface PrimaryVisualTrack {
  readonly name: 'aroll' | 'scenes';
  readonly clips: readonly PrimaryVisualClip[];
}

export function primaryVisualTrackOf(timeline: Timeline): PrimaryVisualTrack {
  const scenes = timeline.tracks.scenes ?? [];
  return scenes.length > 0
    ? { name: 'scenes', clips: scenes }
    : { name: 'aroll', clips: timeline.tracks.aroll };
}

function primaryOverlapIssue(track: PrimaryVisualTrack, index: number, clip: PrimaryVisualClip): TimelineIssue {
  return track.name === 'aroll'
    ? arollOverlapIssue(index, clip)
    : {
        code: 'SCENE_OVERLAP',
        path: `tracks.scenes[${index}].from`,
        message: `La escena "${clip.id}" se solapa con la anterior.`,
      };
}

function primaryGapIssue(track: PrimaryVisualTrack, index: number, clip: PrimaryVisualClip): TimelineIssue {
  return track.name === 'aroll'
    ? arollGapIssue(index, clip)
    : {
        code: 'SCENE_GAP',
        path: `tracks.scenes[${index}].from`,
        message: `Hay un hueco antes de la escena "${clip.id}".`,
      };
}

function scenesAndArollIssue(): TimelineIssue {
  return {
    code: 'SCENES_AND_AROLL',
    path: 'tracks.scenes',
    message: 'Una Timeline usa la pista scenes o la pista aroll como visual primaria, nunca las dos.',
  };
}

function collectPrimaryVisualOrderIssues(timeline: Timeline): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const track = primaryVisualTrackOf(timeline);

  if (track.name === 'scenes' && timeline.tracks.aroll.length > 0) {
    issues.push(scenesAndArollIssue());
  }

  const ordered = [...track.clips].sort((left, right) => left.from - right.from);

  if (ordered.length === 0) {
    issues.push(emptyArollIssue());
    return issues;
  }

  const transitions = timeline.transitions ?? [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previousClip = ordered[index - 1];
    const currentClip = ordered[index];
    if (previousClip === undefined || currentClip === undefined) {
      continue;
    }

    const previousEndFrame = previousClip.from + previousClip.durationFrames;
    const overlapFrames = transitionFramesBetween(transitions, previousClip.id, currentClip.id);
    const expectedFromFrame = previousEndFrame - overlapFrames;

    if (currentClip.from < expectedFromFrame) {
      issues.push(primaryOverlapIssue(track, index, currentClip));
    } else if (currentClip.from > expectedFromFrame) {
      issues.push(primaryGapIssue(track, index, currentClip));
    }
  }

  const lastClip = ordered[ordered.length - 1];
  if (lastClip !== undefined && lastClip.from + lastClip.durationFrames !== timeline.durationFrames) {
    issues.push(durationMismatchIssue(lastClip, timeline.durationFrames));
  }

  return issues;
}

function sceneAssetIds(clip: SceneClip): readonly AssetId[] {
  if (clip.visual.kind === 'asset') {
    return [clip.visual.assetId];
  }
  if (clip.visual.kind === 'remotion' && clip.visual.scene.assetId !== undefined) {
    return [clip.visual.scene.assetId];
  }
  return [];
}

function collectSceneTrackIssues(
  timeline: Timeline,
  assetsById: ReadonlyMap<AssetId, MediaAsset>,
): TimelineIssue[] {
  const issues: TimelineIssue[] = [];

  (timeline.tracks.scenes ?? []).forEach((clip, index) => {
    for (const assetId of sceneAssetIds(clip)) {
      if (!assetsById.has(assetId)) {
        issues.push({
          code: 'SCENE_ASSET_NOT_FOUND',
          path: `tracks.scenes[${index}].visual`,
          message: `La escena "${clip.id}" referencia el asset "${assetId}", que no existe en assets.`,
        });
      }
    }

    if (clip.from < 0 || clip.from + clip.durationFrames > timeline.durationFrames) {
      issues.push({
        code: 'CLIP_OUT_OF_TIMELINE',
        path: `tracks.scenes[${index}].from`,
        message: `La escena "${clip.id}" queda fuera del rango [0, ${timeline.durationFrames}) de la Timeline.`,
      });
    }
  });

  return issues;
}

function collectAllClipIds(timeline: Timeline): Set<ClipId> {
  const clipIds = new Set<ClipId>();

  ASSET_BACKED_TRACK_NAMES.forEach((trackName) => {
    timeline.tracks[trackName].forEach((clip) => clipIds.add(clip.id));
  });
  timeline.tracks.captions.forEach((caption) => clipIds.add(caption.id));
  (timeline.tracks.scenes ?? []).forEach((scene) => clipIds.add(scene.id));

  return clipIds;
}

function transitionClipNotFoundIssue(index: number, missingClipId: ClipId): TimelineIssue {
  return {
    code: 'TRANSITION_CLIP_NOT_FOUND',
    path: `transitions[${index}].betweenClipIds`,
    message: `La transición no encuentra el clip "${missingClipId}".`,
  };
}

function collectTransitionIssues(timeline: Timeline): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const transitions = timeline.transitions ?? [];
  const clipIds = collectAllClipIds(timeline);

  transitions.forEach((transition, index) => {
    const missingClipId = transition.betweenClipIds.find((clipId) => !clipIds.has(clipId));
    if (missingClipId !== undefined) {
      issues.push(transitionClipNotFoundIssue(index, missingClipId));
    }
  });

  return issues;
}

function fitsInSafeZone(box: CaptionClipBox, safeZone: SafeZone, format: OutputFormat): boolean {
  return (
    box.x >= safeZone.left &&
    box.y >= safeZone.top &&
    box.x + box.width <= format.width - safeZone.right &&
    box.y + box.height <= format.height - safeZone.bottom
  );
}

function captionOutOfSafeZoneIssue(index: number, caption: CaptionClip): TimelineIssue {
  return {
    code: 'CAPTION_OUT_OF_SAFE_ZONE',
    path: `tracks.captions[${index}].box`,
    message: `El caption "${caption.id}" queda fuera de la zona segura del formato.`,
  };
}

function collectCaptionSafeZoneIssues(timeline: Timeline): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const safeZone = timeline.safeZone ?? safeZoneFor(timeline.format);

  timeline.tracks.captions.forEach((caption, index) => {
    if (caption.box !== undefined && !fitsInSafeZone(caption.box, safeZone, timeline.format)) {
      issues.push(captionOutOfSafeZoneIssue(index, caption));
    }
  });

  return issues;
}

export function validateTimeline(timeline: Timeline): TimelineValidationResult {
  const parsed = TimelineSchema.safeParse(timeline);
  if (!parsed.success) {
    return { ok: false, issues: schemaInvalidIssues(parsed.error) };
  }

  const assetsById = new Map(parsed.data.assets.map((asset) => [asset.id, asset] as const));
  const issues: TimelineIssue[] = [
    ...collectAssetBackedTrackIssues(parsed.data, assetsById),
    ...collectSceneTrackIssues(parsed.data, assetsById),
    ...collectPrimaryVisualOrderIssues(parsed.data),
    ...collectTransitionIssues(parsed.data),
    ...collectCaptionSafeZoneIssues(parsed.data),
  ];

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
