export { assetSrc } from './helpers/asset-src';
export { timelineToSequenceProps } from './helpers/timeline-to-sequence-props';
export type {
  ArollTransitionPlan,
  AudioSequenceProps,
  CaptionSequenceProps,
  SequencePropsPlan,
  VideoSequenceProps,
} from './helpers/timeline-to-sequence-props';
export type { CaptionBox, TransitionDirection } from './helpers/timeline-types';
export { transitionTiming } from './helpers/transition-timing';
export { punchInStyle } from './helpers/punch-in-style';
export { gainDbToVolume, volumeAtFrame } from './helpers/audio-gain';

export { whipPanStyle } from './transitions/whip-pan-style';
export type { PresentationDirection } from './transitions/whip-pan-style';
export { whipPan } from './transitions/whip-pan';
export type { WhipPanProps } from './transitions/whip-pan';
export { presentationFor } from './transitions/presentation-for';
export type { ArollPresentation } from './transitions/presentation-for';
export { ArollSeries } from './components/aroll-series';
export type { ArollSeriesProps } from './components/aroll-series';
export { BrollTrack } from './components/broll-track';
export type { BrollTrackProps } from './components/broll-track';
export { AudioTrack } from './components/audio-track';
export type { AudioTrackProps } from './components/audio-track';

export { computeTimelineMetadata } from './helpers/timeline-metadata';
export type { TimelineMetadata } from './helpers/timeline-metadata';
export {
  TIMELINE_COMPOSITION_ID,
  TimelineComposition,
  calculateTimelineMetadata,
} from './components/timeline-composition';
export type { TimelineAudioMode, TimelineCompositionProps } from './components/timeline-composition';

export {
  CAPTION_PRESETS,
  CAPTION_PRESET_IDS,
  DEFAULT_CAPTION_PRESET_ID,
  captionPreset,
} from './helpers/caption-preset';
export type {
  CaptionPill,
  CaptionPreset,
  CaptionPresetId,
  CaptionStroke,
  CaptionTextTransform,
} from './helpers/caption-preset';

export {
  CAPTION_PLATFORMS,
  captionChromeInsets,
  captionSafeZone,
} from './helpers/caption-safe-zone';
export type {
  CaptionChromeInsets,
  CaptionChromeReference,
  CaptionPlatform,
} from './helpers/caption-safe-zone';

export { captionBoxFor } from './helpers/caption-box';
export type { CaptionAnchor } from './helpers/caption-box';

export { fitCaptionFontSize } from './helpers/caption-font-size';

export { captionWordStyle } from './helpers/caption-word-style';
export type { CaptionWordState } from './helpers/caption-word-style';

export { captionFontFaceCss } from './helpers/caption-font-face';
export type {
  CaptionFontDisplay,
  CaptionFontFace,
  CaptionFontFormat,
} from './helpers/caption-font-face';

export { captionBlockStyle, captionClipAnimation } from './helpers/caption-animation';
export type {
  CaptionAnimation,
  CaptionAnimationMode,
  CaptionClipAnimation,
  CaptionSpring,
} from './helpers/caption-animation';

export { activeWordIndex, captionWordRenders } from './helpers/caption-active-word';
export type { CaptionWordRender } from './helpers/caption-active-word';

export { captionBoxStyle, captionClipPlan } from './helpers/caption-clip-plan';
export type { CaptionBoxSource, CaptionClipPlan } from './helpers/caption-clip-plan';

export { KineticCaptions } from './components/kinetic-captions';
export type { KineticCaptionsProps } from './components/kinetic-captions';
