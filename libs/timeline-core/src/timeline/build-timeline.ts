import type {
  BrollOverlayDecision,
  CaptionGroupDecision,
  DuckDecision,
  EditDecision,
  EditDecisionList,
  KeepDecision,
  PunchInDecision,
  TransitionDecision,
} from '../schemas/edit-decision-list.schema';
import type { MediaAsset } from '../schemas/media-asset.schema';
import type { OutputFormat } from '../schemas/output-format.schema';
import type {
  AudioClip,
  CaptionClip,
  CaptionClipBox,
  LogoOverlay,
  Timeline,
  TimelineTransition,
  TransitionTiming,
  VideoClip,
} from '../schemas/timeline.schema';
import { LogoOverlaySchema } from '../schemas/timeline.schema';
import type { MusicMixSettings } from '../schemas/audio-mix-plan.schema';
import type { AssetId, ClipId, DecisionId, Db, Frame, Fps, Ms, Scale } from '../types/units';
import { safeZoneFor } from '../format/format';
import { framesToMs, msToFrames } from '../units/units';
import { pickEmphasisIndex } from '../captions/group-words-for-captions';
import { DEFAULT_AUDIO_MIX_PLAN, DEFAULT_MUSIC_MIX, planDucking } from '../ducking/plan-ducking';
import type { VoiceRange } from '../ducking/plan-ducking';
import type { PunchInAnchor } from '../punch-in/plan-punch-ins';
import { sequentialId } from './ids';

export interface MusicInput {
  assetId: AssetId;
  mix?: MusicMixSettings;
  trimStartMs?: Ms;
  gainDb?: Db;
  fadeInFrames?: Frame;
  fadeOutFrames?: Frame;
}

export interface LogoInput {
  assetId: AssetId;
  position?: LogoOverlay['position'];
  widthRatio?: number;
  marginRatio?: number;
  opacity?: number;
}

export type TimelineBuildErrorCode = 'EMPTY_AROLL';

export class TimelineBuildError extends Error {
  readonly code: TimelineBuildErrorCode;

  constructor(code: TimelineBuildErrorCode, message: string) {
    super(message);
    this.name = 'TimelineBuildError';
    this.code = code;
  }
}

interface KeepSubRange {
  startMs: Ms;
  endMs: Ms;
  scale: Scale;
  anchor?: PunchInAnchor;
}

interface KeepPlacement {
  keep: KeepDecision;
  firstClipFrame: Frame;
}

interface ArollTrackResult {
  clips: VideoClip[];
  clipIdsByKeep: Map<DecisionId, ClipId[]>;
  placements: KeepPlacement[];
  durationFrames: Frame;
}

const DEFAULT_SPRING_TIMING: TransitionTiming = {
  type: 'spring',
  damping: 200,
  stiffness: 100,
  mass: 1,
};
const LINEAR_TIMING: TransitionTiming = { type: 'linear' };

function optionalField<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  if (value === undefined) {
    return {} as { [P in K]?: V };
  }
  return { [key]: value } as { [P in K]?: V };
}

function decisionsOfType<T extends EditDecision['type']>(
  decisions: readonly EditDecision[],
  type: T,
): Extract<EditDecision, { type: T }>[] {
  return decisions.filter(
    (decision): decision is Extract<EditDecision, { type: T }> => decision.type === type,
  );
}

function byStartMs<T extends { startMs: Ms }>(left: T, right: T): number {
  return left.startMs - right.startMs;
}

function transitionEnteringKeep(
  transitions: readonly TransitionDecision[],
  keep: KeepDecision,
): TransitionDecision | undefined {
  return transitions.find((transition) => transition.atMs === keep.startMs);
}

function punchInsWithinKeep(
  punches: readonly PunchInDecision[],
  keep: KeepDecision,
): PunchInDecision[] {
  return punches.filter((punch) => punch.startMs >= keep.startMs && punch.endMs <= keep.endMs);
}

function splitKeepByPunchIns(
  keep: KeepDecision,
  punchesInKeep: readonly PunchInDecision[],
): KeepSubRange[] {
  const sortedPunches = [...punchesInKeep].sort(byStartMs);
  const subRanges: KeepSubRange[] = [];
  let cursorMs = keep.startMs;

  for (const punch of sortedPunches) {
    if (punch.startMs > cursorMs) {
      subRanges.push({ startMs: cursorMs, endMs: punch.startMs, scale: 1 });
    }
    subRanges.push({
      startMs: punch.startMs,
      endMs: punch.endMs,
      scale: punch.scale,
      ...optionalField('anchor', punch.anchor),
    });
    cursorMs = punch.endMs;
  }

  if (cursorMs < keep.endMs) {
    subRanges.push({ startMs: cursorMs, endMs: keep.endMs, scale: 1 });
  }

  return subRanges;
}

function buildArollTrack(
  keeps: readonly KeepDecision[],
  punches: readonly PunchInDecision[],
  transitions: readonly TransitionDecision[],
  sourceAssetId: AssetId,
  fps: Fps,
): ArollTrackResult {
  const clips: VideoClip[] = [];
  const clipIdsByKeep = new Map<DecisionId, ClipId[]>();
  const placements: KeepPlacement[] = [];
  let cursorFrame = 0;

  keeps.forEach((keep, keepIndex) => {
    if (keepIndex > 0) {
      const enteringTransition = transitionEnteringKeep(transitions, keep);
      if (enteringTransition !== undefined) {
        cursorFrame -= msToFrames(enteringTransition.durationMs, fps);
      }
    }

    const firstClipFrame = cursorFrame;
    const subRanges = splitKeepByPunchIns(keep, punchInsWithinKeep(punches, keep));
    const clipIds: ClipId[] = [];

    for (const subRange of subRanges) {
      const durationFrames = Math.max(1, msToFrames(subRange.endMs - subRange.startMs, fps));
      const clip: VideoClip = {
        id: sequentialId('aroll', clips.length),
        assetId: sourceAssetId,
        from: cursorFrame,
        durationFrames,
        trimStartMs: subRange.startMs,
        muted: true,
        transform: {
          scale: subRange.scale,
          translateX: 0,
          translateY: 0,
          ...optionalField('anchor', subRange.anchor),
        },
      };
      clips.push(clip);
      clipIds.push(clip.id);
      cursorFrame += durationFrames;
    }

    clipIdsByKeep.set(keep.id, clipIds);
    placements.push({ keep, firstClipFrame });
  });

  return { clips, clipIdsByKeep, placements, durationFrames: cursorFrame };
}

function buildVoiceTrack(arollClips: readonly VideoClip[]): AudioClip[] {
  return arollClips.map((clip, index) => ({
    id: sequentialId('voice', index),
    assetId: clip.assetId,
    from: clip.from,
    durationFrames: clip.durationFrames,
    trimStartMs: clip.trimStartMs,
    gainDb: 0,
  }));
}

function findPlacementForRange(
  placements: readonly KeepPlacement[],
  startMs: Ms,
  endMs: Ms,
): KeepPlacement | undefined {
  return placements.find(
    (placement) => startMs >= placement.keep.startMs && endMs <= placement.keep.endMs,
  );
}

function frameWithinKeep(placement: KeepPlacement, ms: Ms, fps: Fps): Frame {
  return placement.firstClipFrame + msToFrames(ms - placement.keep.startMs, fps);
}

function buildBrollTrack(
  decisions: readonly BrollOverlayDecision[],
  placements: readonly KeepPlacement[],
  fps: Fps,
): VideoClip[] {
  const clips: VideoClip[] = [];

  for (const decision of decisions) {
    const placement = findPlacementForRange(placements, decision.startMs, decision.endMs);
    if (placement === undefined) {
      continue;
    }

    clips.push({
      id: sequentialId('broll', clips.length),
      assetId: decision.assetId,
      from: frameWithinKeep(placement, decision.startMs, fps),
      durationFrames: Math.max(1, msToFrames(decision.endMs - decision.startMs, fps)),
      trimStartMs: 0,
      muted: decision.keepVoice !== false,
      fit: decision.fit,
      transform: { scale: 1, translateX: 0, translateY: 0 },
    });
  }

  return clips;
}

function safeZoneBox(format: OutputFormat): CaptionClipBox {
  const safeZone = safeZoneFor(format);
  return {
    x: safeZone.left,
    y: safeZone.top,
    width: format.width - safeZone.left - safeZone.right,
    height: format.height - safeZone.top - safeZone.bottom,
  };
}

function buildCaptionTrack(
  decisions: readonly CaptionGroupDecision[],
  placements: readonly KeepPlacement[],
  format: OutputFormat,
  fps: Fps,
): CaptionClip[] {
  const box = safeZoneBox(format);
  const clips: CaptionClip[] = [];

  for (const decision of decisions) {
    const placement = findPlacementForRange(placements, decision.startMs, decision.endMs);
    if (placement === undefined) {
      continue;
    }

    const from = frameWithinKeep(placement, decision.startMs, fps);
    const keepEndFrame = frameWithinKeep(placement, placement.keep.endMs, fps);
    const rawEndFrame = frameWithinKeep(placement, decision.endMs, fps);
    const durationFrames = Math.max(1, Math.min(rawEndFrame, keepEndFrame) - from);

    clips.push({
      id: sequentialId('caption', clips.length),
      from,
      durationFrames,
      words: decision.words.map((word) => ({
        text: word.text,
        fromFrame: Math.max(0, frameWithinKeep(placement, word.startMs, fps) - from),
        durationFrames: Math.max(1, msToFrames(word.endMs - word.startMs, fps)),
      })),
      emphasisIndex: decision.emphasisIndex ?? pickEmphasisIndex(decision.words),
      box,
    });
  }

  return clips;
}

function resolveTransitionTiming(timing: TransitionDecision['timing']): TransitionTiming {
  return timing === 'linear' ? LINEAR_TIMING : DEFAULT_SPRING_TIMING;
}

function buildTimelineTransitions(
  transitions: readonly TransitionDecision[],
  keeps: readonly KeepDecision[],
  clipIdsByKeep: ReadonlyMap<DecisionId, readonly ClipId[]>,
  fps: Fps,
): TimelineTransition[] {
  const keepsByStart = [...keeps].sort(byStartMs);
  const timelineTransitions: TimelineTransition[] = [];

  for (const transition of transitions) {
    const enteringIndex = keepsByStart.findIndex((keep) => keep.startMs === transition.atMs);
    if (enteringIndex <= 0) {
      continue;
    }

    const enteringKeep = keepsByStart[enteringIndex];
    const outgoingKeep = keepsByStart[enteringIndex - 1];
    if (enteringKeep === undefined || outgoingKeep === undefined) {
      continue;
    }

    const outgoingClipIds = clipIdsByKeep.get(outgoingKeep.id) ?? [];
    const enteringClipIds = clipIdsByKeep.get(enteringKeep.id) ?? [];
    const lastOutgoingClipId = outgoingClipIds[outgoingClipIds.length - 1];
    const firstEnteringClipId = enteringClipIds[0];
    if (lastOutgoingClipId === undefined || firstEnteringClipId === undefined) {
      continue;
    }

    timelineTransitions.push({
      betweenClipIds: [lastOutgoingClipId, firstEnteringClipId],
      kind: transition.kind,
      durationFrames: Math.max(1, msToFrames(transition.durationMs, fps)),
      timing: resolveTransitionTiming(transition.timing),
      ...optionalField('direction', transition.direction),
    });
  }

  return timelineTransitions;
}

function buildDuckVoiceRanges(
  decisions: readonly DuckDecision[],
  placements: readonly KeepPlacement[],
  fps: Fps,
): VoiceRange[] {
  const ranges: VoiceRange[] = [];

  for (const decision of decisions) {
    const placement = findPlacementForRange(placements, decision.startMs, decision.endMs);
    if (placement === undefined) {
      continue;
    }

    ranges.push({
      startMs: framesToMs(frameWithinKeep(placement, decision.startMs, fps), fps),
      endMs: framesToMs(frameWithinKeep(placement, decision.endMs, fps), fps),
    });
  }

  return ranges;
}

function buildMusicClip(music: MusicInput, musicBaseGainDb: Db, durationFrames: Frame): AudioClip {
  return {
    id: sequentialId('music', 0),
    assetId: music.assetId,
    from: 0,
    durationFrames,
    trimStartMs: music.trimStartMs ?? 0,
    gainDb: music.gainDb ?? musicBaseGainDb,
    ...optionalField('fadeInFrames', music.fadeInFrames),
    ...optionalField('fadeOutFrames', music.fadeOutFrames),
  };
}

function buildLogoOverlay(logo: LogoInput): LogoOverlay {
  return LogoOverlaySchema.parse({
    assetId: logo.assetId,
    ...optionalField('position', logo.position),
    ...optionalField('widthRatio', logo.widthRatio),
    ...optionalField('marginRatio', logo.marginRatio),
    ...optionalField('opacity', logo.opacity),
  });
}

export function buildTimeline(
  edl: EditDecisionList,
  assets: readonly MediaAsset[],
  music?: MusicInput,
  logo?: LogoInput,
): Timeline {
  const fps = edl.format.fps;
  const keeps = decisionsOfType(edl.decisions, 'keep').sort(byStartMs);
  if (keeps.length === 0) {
    throw new TimelineBuildError(
      'EMPTY_AROLL',
      `El EDL de "${edl.sourceAssetId}" no tiene ninguna decisión "keep".`,
    );
  }

  const punches = decisionsOfType(edl.decisions, 'punch-in').sort(byStartMs);
  const transitions = decisionsOfType(edl.decisions, 'transition');
  const brollDecisions = decisionsOfType(edl.decisions, 'broll-overlay');
  const captionDecisions = decisionsOfType(edl.decisions, 'caption-group');
  const duckDecisions = decisionsOfType(edl.decisions, 'duck');

  const arollTrack = buildArollTrack(keeps, punches, transitions, edl.sourceAssetId, fps);
  const voiceClips = buildVoiceTrack(arollTrack.clips);
  const brollClips = buildBrollTrack(brollDecisions, arollTrack.placements, fps);
  const captionClips = buildCaptionTrack(captionDecisions, arollTrack.placements, edl.format, fps);
  const timelineTransitions = buildTimelineTransitions(
    transitions,
    keeps,
    arollTrack.clipIdsByKeep,
    fps,
  );

  const duckRanges = buildDuckVoiceRanges(duckDecisions, arollTrack.placements, fps);
  const musicMix = { ...(music?.mix ?? DEFAULT_MUSIC_MIX) };
  const automation =
    music !== undefined ? planDucking(duckRanges, musicMix, fps).automation : [];
  const audioMix = {
    voice: { ...DEFAULT_AUDIO_MIX_PLAN.voice },
    music: musicMix,
    automation,
  };
  const musicClips =
    music !== undefined
      ? [buildMusicClip(music, audioMix.music.baseGainDb, arollTrack.durationFrames)]
      : [];

  return {
    schemaVersion: 1,
    id: `timeline-${edl.sourceAssetId}`,
    format: edl.format,
    durationFrames: arollTrack.durationFrames,
    assets: [...assets],
    tracks: {
      aroll: arollTrack.clips,
      broll: brollClips,
      voice: voiceClips,
      music: musicClips,
      captions: captionClips,
    },
    transitions: timelineTransitions,
    audioMix,
    ...optionalField('logo', logo === undefined ? undefined : buildLogoOverlay(logo)),
    safeZone: safeZoneFor(edl.format),
  };
}
