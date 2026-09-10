export { assetSrc } from './helpers/asset-src';
export { timelineToSequenceProps } from './helpers/timeline-to-sequence-props';
export type {
  ArollTransitionPlan,
  AudioSequenceProps,
  CaptionSequenceProps,
  SequencePropsPlan,
  VideoSequenceProps,
} from './helpers/timeline-to-sequence-props';
export type {
  SceneAssetPlan,
  ScenePlaceholderPlan,
  SceneRemotionPlan,
  SceneSequenceProps,
  SceneVisualPlan,
} from './helpers/timeline-to-sequence-props';
export type { CaptionBox, TransitionDirection } from './helpers/timeline-types';

export { captionBandTop, sceneTheme } from './helpers/scene-theme';
export type { SceneTheme, SceneThemeRole } from './helpers/scene-theme';
export { DEFAULT_IMAGE_KEN_BURNS, kenBurnsCss, kenBurnsProgress, kenBurnsTransform } from './helpers/ken-burns';
export type { KenBurnsInput, KenBurnsTransform } from './helpers/ken-burns';
export { MONOSPACE_ADVANCE_EM, codeLayout, columnsThatFit } from './helpers/code-lines';
export type { CodeLayout, CodeLayoutOptions } from './helpers/code-lines';

export { SceneTrack, sceneLoopFrames } from './components/scene-track';
export type { SceneTrackProps } from './components/scene-track';
export { TitleScene } from './components/scenes/title-scene';
export type { TitleSceneProps } from './components/scenes/title-scene';
export { TextScene } from './components/scenes/text-scene';
export type { TextSceneProps } from './components/scenes/text-scene';
export { CodeScene } from './components/scenes/code-scene';
export type { CodeSceneProps } from './components/scenes/code-scene';
export { ImageKenBurnsScene } from './components/scenes/image-ken-burns-scene';
export type { ImageKenBurnsSceneProps } from './components/scenes/image-ken-burns-scene';
export { PlaceholderScene } from './components/scenes/placeholder-scene';
export type { PlaceholderSceneProps } from './components/scenes/placeholder-scene';
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
export { TimelineVideo } from './components/timeline-video';
export type { TimelineVideoProps } from './components/timeline-video';
export { DEFAULT_VIDEO_BACKEND, VideoBackendProvider, useVideoBackend } from './components/video-backend';
export type { VideoBackend, VideoBackendProviderProps } from './components/video-backend';
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
