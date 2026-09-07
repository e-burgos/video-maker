export { OutputFormatSchema, OutputPresetSchema, SafeZoneSchema } from './schemas/output-format.schema';
export type { OutputFormat, OutputPreset, SafeZone } from './schemas/output-format.schema';

export { MediaAssetSchema, MediaKindSchema } from './schemas/media-asset.schema';
export type { MediaAsset, MediaAssetAudio, MediaKind } from './schemas/media-asset.schema';

export { SegmentSchema, TranscriptionEngineSchema, TranscriptionSchema, WordSchema } from './schemas/transcription.schema';
export type { Segment, Transcription, TranscriptionEngine, Word } from './schemas/transcription.schema';

export {
  BrollOverlayDecisionSchema,
  CaptionGroupDecisionSchema,
  CutDecisionSchema,
  DuckDecisionSchema,
  EditDecisionListSchema,
  EditDecisionSchema,
  KeepDecisionSchema,
  PunchInDecisionSchema,
  TransitionDecisionSchema,
} from './schemas/edit-decision-list.schema';
export type {
  BrollOverlayDecision,
  CaptionGroupDecision,
  CutDecision,
  CutReason,
  DuckDecision,
  EditDecision,
  EditDecisionList,
  KeepDecision,
  PunchInDecision,
  TransitionDecision,
} from './schemas/edit-decision-list.schema';

export { AudioMixPlanSchema, GainKeyframeSchema } from './schemas/audio-mix-plan.schema';
export type { AudioMixPlan, GainKeyframe } from './schemas/audio-mix-plan.schema';

export {
  AudioClipSchema,
  CaptionClipSchema,
  TimelineSchema,
  TimelineTransitionSchema,
  VideoClipSchema,
} from './schemas/timeline.schema';
export type {
  AudioClip,
  CaptionClip,
  Timeline,
  TimelineTransition,
  VideoClip,
} from './schemas/timeline.schema';

export type { AssetId, ClipId, DecisionId, Db, Fps, Frame, Lufs, Ms, Rounding, Scale } from './types/units';

export { framesToMs, msToFrames } from './units/units';

export { DEFAULT_SAFE_ZONES, defaultFormat, safeZoneFor } from './format/format';

export { detectSilencesFromWords } from './silence/detect-silences';
export type { DetectSilencesOptions, SilenceRange } from './silence/detect-silences';

export { mergeSilences } from './silence/merge-silences';

export { pruneSilences } from './silence/prune-silences';
export type {
  CutRange,
  KeepRange,
  PruneSilencesOptions,
  PruneSilencesResult,
} from './silence/prune-silences';

export { planPunchIns } from './punch-in/plan-punch-ins';
export type { PunchInAnchor, PunchInOptions, PunchInPlan } from './punch-in/plan-punch-ins';

export { remapMsAfterCuts } from './timeline/remap-ms-after-cuts';
