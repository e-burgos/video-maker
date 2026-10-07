export { fitBeatGrid } from './beats/fit-beat-grid';
export type { BeatGrid, FitBeatGridOptions } from './beats/fit-beat-grid';
export { parseHyperframesBeats } from './beats/parse-hyperframes-beats';
export type { Onset } from './beats/parse-hyperframes-beats';

export { isMotionStudioError, MotionStudioError } from './errors/motion-studio-error';
export type { MotionStudioErrorCode } from './errors/motion-studio-error';

export { parseMotionScript } from './script/motion-script';
export type { MotionScene, MotionScript, MotionSfx } from './script/motion-script';

export { composeTemplate, templateValues, WHOOSH_LEAD, wordTime } from './template/compose-template';
export type { MotionTimeline, SceneWords, SpokenWord } from './template/motion-timeline';

export { buildDuckAutomation } from './timeline/build-duck-automation';
export type { AutomationPoint, DuckOptions, VolumeAutomation } from './timeline/build-duck-automation';
export { DEFAULT_VO_LEAD_IN, DEFAULT_VO_TAIL, layoutScenes } from './timeline/layout-scenes';
export type { LayoutOptions, SceneSlot } from './timeline/layout-scenes';

export { intelligibilityScore, normalizeWords } from './voice/intelligibility-score';
export { pickBestTake } from './voice/pick-best-take';
export type { BestTakeOptions, BestTakePorts, HeardWord, TakeAttempt, TakeTranscript } from './voice/pick-best-take';
export { wavDurationSec } from './voice/wav-duration';

export { BrandManifestSchema, parseBrandManifest } from './brand/brand-manifest';
export type { BrandManifest } from './brand/brand-manifest';
export { BRAND_ASSET_DIR, brandImageUrl, composeStoryboard, MOTION_COMPOSITION_ID, RUNTIME_ASSET_DIR, storyboardImages } from './compose/compose-storyboard';
export type { ComposedStoryboard, ScriptDocument } from './compose/compose-storyboard';
export { renderScene } from './scenes/render-scene';
export type { SceneContext } from './scenes/scene-html';
export { formatIssuePath, motionStoryboardJsonSchema, parseMotionStoryboard } from './storyboard/parse-motion-storyboard';
export { ICON_NAMES, MotionSceneSchema, MotionStoryboardSchema, SCENE_KINDS } from './storyboard/motion-storyboard.schema';
export type { IconName, MotionChip, MotionSceneKind, MotionScreen, MotionStoryboard, MotionStoryboardScene, MotionVisual, SceneOf } from './storyboard/motion-storyboard.schema';
