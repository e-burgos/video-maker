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
