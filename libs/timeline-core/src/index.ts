export { OUTPUT_PRESETS, OutputFormatSchema, OutputPresetSchema, SafeZoneSchema } from './schemas/output-format.schema';
export type { OutputFormat, OutputPreset, SafeZone } from './schemas/output-format.schema';

export { MediaAssetSchema, MediaKindSchema } from './schemas/media-asset.schema';
export type { MediaAsset, MediaAssetAudio, MediaKind } from './schemas/media-asset.schema';

export {
  SegmentSchema,
  TranscriptionEngineSchema,
  TranscriptionSchema,
  WordSchema,
  normalizeTranscriptionWords,
} from './schemas/transcription.schema';
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

export {
  AudioMixPlanSchema,
  GainKeyframeSchema,
  MusicMixSettingsSchema,
  VoiceTargetSchema,
} from './schemas/audio-mix-plan.schema';
export type { AudioMixPlan, GainKeyframe, MusicMixSettings, VoiceTarget } from './schemas/audio-mix-plan.schema';

export {
  AudioClipSchema,
  CaptionClipSchema,
  CaptionStyleSchema,
  CaptionThemeSchema,
  DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR,
  DEFAULT_LOGO_BUMPER_DURATION_MS,
  DEFAULT_LOGO_BUMPER_WIDTH_RATIO,
  HexColorSchema,
  LOGO_BUMPER_ANIMATIONS,
  LogoBumperAnimationSchema,
  LogoBumperSchema,
  DELIVERY_KINDS,
  DeliveryContractSchema,
  LogoOverlaySchema,
  LogoPositionSchema,
  MAX_LOGO_BUMPER_DURATION_MS,
  MIN_LOGO_BUMPER_DURATION_MS,
  TimelineBumpersSchema,
  TimelineSchema,
  TimelineTransitionSchema,
  VideoClipSchema,
} from './schemas/timeline.schema';
export type {
  AudioClip,
  CaptionClip,
  CaptionTheme,
  DeliveryContract,
  DeliveryKind,
  LogoBumper,
  LogoBumperAnimation,
  LogoOverlay,
  LogoPosition,
  Timeline,
  TimelineBumpers,
  TimelineTransition,
  VideoClip,
} from './schemas/timeline.schema';

export {
  DEFAULT_MUSIC_REFERENCE_LUFS,
  MUSIC_NORMALIZATION_MAX_GAIN_DB,
  musicNormalizationGainDb,
} from './audio/music-normalization';

export type { AssetId, ClipId, DecisionId, Db, Fps, Frame, Lufs, Ms, Rounding, Scale } from './types/units';

export { framesToMs, msToFrames } from './units/units';

export { defaultFormat, safeZoneFor } from './format/format';

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

export { TimelineBuildError, buildTimeline } from './timeline/build-timeline';
export {
  LANDSCAPE_LOGO_WIDTH_RATIO,
  PORTRAIT_LOGO_WIDTH_RATIO,
  defaultLogoWidthRatio,
} from './timeline/logo-defaults';
export type { LogoInput, MusicInput, TimelineBuildErrorCode, VoiceInput } from './timeline/build-timeline';

export { timelineWarnings, validateTimeline } from './timeline/validate-timeline';
export type {
  TimelineIssue,
  TimelineIssueCode,
  TimelineValidationResult,
  TimelineWarning,
  TimelineWarningCode,
} from './timeline/validate-timeline';

export {
  introBumperFrames,
  logoBumperFrames,
  outroBumperFrames,
  timelineTotalFrames,
} from './timeline/bumper-frames';

export { groupWordsForCaptions, pickEmphasisIndex } from './captions/group-words-for-captions';
export type {
  CaptionGroupOptions,
  CaptionGroupPlan,
  TranscriptWord,
} from './captions/group-words-for-captions';

export { CAPTION_STYLES, captionGroupingForStyle, isCaptionStyle } from './captions/caption-style';
export type { CaptionStyle, CaptionStyleGrouping } from './captions/caption-style';

export { DEFAULT_AUDIO_MIX_PLAN, DEFAULT_MUSIC_MIX, planDucking } from './ducking/plan-ducking';
export {
  DEFAULT_SEGMENTED_MUSIC_FLOOR_DB,
  planSegmentedMusic,
  SEGMENTED_MUSIC_FADE_MS,
  SEGMENTED_MUSIC_MIN_GAP_MS,
  segmentedMusicMix,
} from './ducking/plan-segmented-music';
export type { MusicMode, SegmentedMusicOptions } from './ducking/plan-segmented-music';
export type { DuckDecisionPlan, DuckingPlanResult, VoiceRange } from './ducking/plan-ducking';

export { buildJsonSchemaBundle, serializeJsonSchemaFile, timelineToJsonSchema } from './schemas/json-schema';
export type { JsonObject, JsonValue } from './schemas/json-schema';
export type { SchemaFileName } from './schemas/registry';

export {
  RemotionSceneKindSchema,
  RemotionSceneSchema,
  STORYBOARD_SCHEMA_VERSION,
  StoryboardCharacterProposalSchema,
  StoryboardCharacterSchema,
  StoryboardDocumentSchema,
  StoryboardFormatSchema,
  StoryboardProposalSchema,
  StoryboardSceneProposalSchema,
  StoryboardSceneSchema,
  StoryboardSourceSchema,
  VisualSourceSchema,
  normalizeStoryboardProposalInput,
  storyboardProposalJsonSchema,
  toStoryboardDocument,
} from './schemas/storyboard.schema';
export type {
  RemotionScene,
  RemotionSceneKind,
  StoryboardCharacter,
  StoryboardDocument,
  StoryboardFormat,
  StoryboardIdentity,
  StoryboardProposal,
  StoryboardScene,
  StoryboardSource,
  VisualSource,
} from './schemas/storyboard.schema';

export {
  emptyVoiceManifest,
  VOICE_MANIFEST_SCHEMA_VERSION,
  VoiceManifestSchema,
  VoiceTrackSchema,
  VoiceTrackSourceSchema,
} from './schemas/voice-manifest.schema';
export type { VoiceManifest, VoiceTrack, VoiceTrackSource } from './schemas/voice-manifest.schema';

export {
  DEFAULT_VOICE_SCRIPT_GAP_MS,
  splitVoiceScriptLines,
  VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
  VoiceScriptLineSchema,
  VoiceScriptManifestSchema,
  voiceScriptManifestIsTimed,
} from './schemas/voice-script-manifest.schema';
export type {
  VoiceScriptLine,
  VoiceScriptManifest,
  VoiceScriptWordsSource,
} from './schemas/voice-script-manifest.schema';

export { hashNarration } from './voice/hash-narration';
export {
  directedLengthScale,
  hasVoiceDirection,
  MAX_VOICE_PAUSE_AFTER_MS,
  VOICE_ENERGIES,
  VOICE_PACES,
  VoiceDirectionSchema,
  voiceDirectionSynthesis,
  VoiceScriptDirectionsSchema,
} from './voice/voice-direction';
export type {
  VoiceDirection,
  VoiceDirectionSynthesis,
  VoiceEnergy,
  VoicePace,
  VoiceScriptDirections,
} from './voice/voice-direction';
export {
  hasVoiceScriptTimeMarks,
  parseVoiceScriptLines,
  stripVoiceScriptTimeMarks,
} from './voice/parse-voice-script-lines';
export type { ParsedVoiceScriptLine } from './voice/parse-voice-script-lines';
export {
  planVoiceScriptPlacements,
  VOICE_SCRIPT_MIN_LENGTH_SCALE,
} from './voice/plan-voice-script-placements';
export type {
  PlanVoiceScriptPlacementsOptions,
  VoiceScriptPlacement,
  VoiceScriptPlacementRequest,
} from './voice/plan-voice-script-placements';
export {
  dropVoiceTracksOutsideScenes,
  findVoiceTrack,
  isVoiceTrackStale,
  upsertVoiceTrack,
} from './voice/merge-voice-manifest';


export {
  ReviewFindingSchema,
  ReviewReportSchema,
  ReviewSeveritySchema,
  ReviewStatusSchema,
  REVIEW_SEVERITIES,
  reviewStatusFor,
} from './review/review-report';
export type { ReviewFinding, ReviewReport, ReviewSeverity, ReviewStatus } from './review/review-report';
