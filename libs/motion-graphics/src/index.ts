export { fitBeatGrid } from './beats/fit-beat-grid';
export type { BeatGrid, FitBeatGridOptions } from './beats/fit-beat-grid';
export { parseHyperframesBeats } from './beats/parse-hyperframes-beats';
export type { Onset } from './beats/parse-hyperframes-beats';

export { isMotionStudioError, MotionStudioError } from './errors/motion-studio-error';
export type { MotionStudioErrorCode } from './errors/motion-studio-error';

export { parseMotionScript } from './script/motion-script';
export type { MotionScene, MotionScript, MotionSfx } from './script/motion-script';

export { composeTemplate, MOTION_MUSIC_TRACK_VOLUME, templateValues, WHOOSH_LEAD, wordTime } from './template/compose-template';
export type { MotionTimeline, SceneWords, SpokenWord } from './template/motion-timeline';

export { buildDuckAutomation } from './timeline/build-duck-automation';
export type { AutomationPoint, DuckOptions, VolumeAutomation } from './timeline/build-duck-automation';
export { DEFAULT_VO_LEAD_IN, DEFAULT_VO_TAIL, layoutScenes } from './timeline/layout-scenes';
export type { LayoutOptions, SceneSlot } from './timeline/layout-scenes';

export { intelligibilityScore, normalizeWords } from './voice/intelligibility-score';
export { pickBestTake } from './voice/pick-best-take';
export type { BestTakeOptions, BestTakePorts, HeardWord, TakeAttempt, TakeTranscript } from './voice/pick-best-take';
export { wavDurationSec } from './voice/wav-duration';

export { activeDeviceIds, BrandManifestSchema, brandImageCaption, brandImageFile, parseBrandManifest } from './brand/brand-manifest';
export type { BrandManifest } from './brand/brand-manifest';
export { brandCss, effectiveBrandTokens, parseCssTokens } from './brand/brand-css';
export { deriveBrandTokens, tokensToCss } from './brand/derive-brand-tokens';
export type { BrandPalette, BrandTypography } from './brand/derive-brand-tokens';
export { brandCssFile, brandIsotipo, BRAND_TOKEN_NAME } from './brand/brand-manifest';
export { BRAND_ASSET_DIR, brandImageUrl, composeStoryboard, MOTION_COMPOSITION_ID, RUNTIME_ASSET_DIR, storyboardImages, storyboardSceneImageRefs } from './compose/compose-storyboard';
export type { ComposedStoryboard, ScriptDocument } from './compose/compose-storyboard';
export { renderScene } from './scenes/render-scene';
export type { SceneContext } from './scenes/scene-html';
export { formatIssuePath, motionStoryboardJsonSchema, parseMotionStoryboard } from './storyboard/parse-motion-storyboard';
export { ICON_NAMES, MotionSceneSchema, MotionStoryboardSchema, SCENE_KINDS } from './storyboard/motion-storyboard.schema';
export type { IconName, MotionChip, MotionSceneKind, MotionScreen, MotionStoryboard, MotionStoryboardScene, MotionVisual, SceneOf } from './storyboard/motion-storyboard.schema';

export { buildAutoStoryboardRequest } from './auto/build-auto-storyboard-request';
export type { AutoStoryboardRequest } from './auto/build-auto-storyboard-request';
export { checkStoryboardAgainstBrief, enforceBrief } from './auto/check-storyboard-against-brief';
export type { StoryboardIssue } from './auto/check-storyboard-against-brief';
export { generateMotionStoryboard } from './auto/generate-motion-storyboard';
export type { AskResponse, AskStoryboardAgent, AskUsage, GeneratedStoryboard } from './auto/generate-motion-storyboard';
export { briefImageRef, MotionBriefSchema, parseMotionBrief } from './auto/motion-brief';
export type { MotionBrief } from './auto/motion-brief';
export { SCENE_GUIDE } from './auto/scene-guide';

export { autoStoryboard } from './pipeline/auto-storyboard';
export type { AutoStoryboardResult } from './pipeline/auto-storyboard';
export { composeFromStoryboard } from './pipeline/compose-from-storyboard';
export { composeProject } from './pipeline/compose-project';
export { initFromTemplate } from './pipeline/init-from-template';
export { joinPath } from './pipeline/join-path';
export { planProject } from './pipeline/plan-project';
export type { MotionPipelinePorts, RenderRequest } from './pipeline/ports';
export { renderProject } from './pipeline/render-project';
export type { RenderProjectOptions } from './pipeline/render-project';
export { voiceProject } from './pipeline/voice-project';
export type { VoicedLine, VoiceProjectOptions, VoiceProjectResult } from './pipeline/voice-project';
export { HYPERFRAMES_VERSION, hyperframesInvocation } from './pipeline/hyperframes-invocation';
export type { HyperframesInvocation, HyperframesInvocationInput } from './pipeline/hyperframes-invocation';
