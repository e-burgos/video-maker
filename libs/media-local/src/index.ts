export type { CommandOptions, CommandResult, CommandRunner } from './runner/command-runner';

export { ExecaCommandRunner, SPAWN_FAILURE_EXIT_CODE } from './runner/execa-command-runner';
export type { ExecaCommandRunnerOptions } from './runner/execa-command-runner';

export { FixtureCommandRunner } from './runner/fixture-command-runner';
export type {
  FixtureCall,
  FixtureResponse,
  FixtureResponseFactory,
  FixtureRoute,
} from './runner/fixture-command-runner';

export { isMediaLocalError, MediaLocalError } from './errors/media-local-error';
export type { MediaLocalErrorCode } from './errors/media-local-error';

export { BinaryNotFoundError } from './errors/binary-not-found-error';
export { CommandFailedError, STDERR_MAX_BYTES } from './errors/command-failed-error';
export { SAMPLE_MAX_CHARS, UnparseableOutputError } from './errors/unparseable-output-error';

export {
  APP_DATA_MODELS_DIR_ENV_VAR,
  BINARY_COMMAND_NAMES,
  BINARY_ENV_VARS,
  BUNDLED_BIN_DIR_ENV_VAR,
  resolveBinaries,
  resolveBinary,
  resolveVoiceBinaries,
} from './binaries/resolve-binaries';
export type {
  BinaryName,
  ResolvedBinaries,
  ResolvedVoiceBinaries,
  ResolveBinariesOptions,
} from './binaries/resolve-binaries';

export { narrationToSingleLine, synthesizeSpeech } from './tts/synthesize-speech';
export type { SynthesizeSpeechOptions } from './tts/synthesize-speech';
export {
  buildVoiceCatalog,
  describeVoiceModel,
  DEFAULT_VOICE_ID,
  VOICE_DIRECTORY_PREFIX,
  VOICE_ESPEAK_DATA_DIR_NAME,
  VOICE_MODEL_CONFIG_EXTENSION,
  VOICE_MODEL_EXTENSION,
  VOICE_QUALITIES,
  VOICE_TOKENS_FILE_NAME,
  voiceDirectoryName,
  voiceIdFromDirectoryName,
  voiceModelConfigFileName,
  voiceModelId,
} from './tts/build-voice-catalog';
export type {
  VoiceLanguage,
  VoiceModel,
  VoiceModelFile,
  VoiceQuality,
} from './tts/build-voice-catalog';

export { nodeBinaryLookup } from './fs/binary-lookup';
export type { BinaryLookup } from './fs/binary-lookup';

export { systemClock } from './clock';
export type { Clock } from './clock';

export { nodeReadTextFile } from './fs/read-text-file';
export type { ReadTextFile } from './fs/read-text-file';

export { parseFfprobeJson, pixelFormatHasAlpha } from './ffprobe/parse-ffprobe-json';
export type { ParseFfprobeContext } from './ffprobe/parse-ffprobe-json';
export { probeMedia } from './ffprobe/probe-media';
export type { ProbeMediaOptions } from './ffprobe/probe-media';

export { parseSilenceDetect } from './ffmpeg/parse-silence-detect';
export type { ParseSilenceDetectContext } from './ffmpeg/parse-silence-detect';
export {
  DEFAULT_SILENCE_MIN_MS,
  DEFAULT_SILENCE_NOISE_DB,
  detectSilencesWithFfmpeg,
} from './ffmpeg/detect-silences';
export type { DetectSilencesWithFfmpegOptions } from './ffmpeg/detect-silences';

export { parseLoudnormJson } from './ffmpeg/parse-loudnorm-json';
export type { LoudnessMeasurement } from './ffmpeg/parse-loudnorm-json';
export { DEFAULT_VOICE_TARGET, FIRST_AUDIO_STREAM, measureLoudness } from './ffmpeg/measure-loudness';
export type { MeasureLoudnessOptions } from './ffmpeg/measure-loudness';
export { buildLoudnormFilter } from './ffmpeg/build-loudnorm-filter';
export { normalizeVoice } from './ffmpeg/normalize-voice';
export type { NormalizeVoiceOptions, NormalizeVoiceResult } from './ffmpeg/normalize-voice';

export { extractAudioForTranscription } from './ffmpeg/extract-audio';
export type { ExtractAudioOptions } from './ffmpeg/extract-audio';

export {
  DEFAULT_EXTRACT_FRAME_MAX_LONG_SIDE_PX,
  DEFAULT_EXTRACT_FRAME_QUALITY,
  extractFrame,
  extractFrameScaleFilter,
} from './ffmpeg/extract-frame';
export type { ExtractFrameOptions } from './ffmpeg/extract-frame';

export {
  DEFAULT_RESIZE_IMAGE_MAX_LONG_SIDE_PX,
  DEFAULT_RESIZE_IMAGE_QUALITY,
  resizeImage,
} from './ffmpeg/resize-image';
export type { ResizeImageOptions } from './ffmpeg/resize-image';

export {
  buildKenBurnsClip,
  DEFAULT_KEN_BURNS_FPS,
  DEFAULT_KEN_BURNS_MAX_ZOOM,
  DEFAULT_KEN_BURNS_OUTPUT_HEIGHT,
  DEFAULT_KEN_BURNS_OUTPUT_WIDTH,
  DEFAULT_KEN_BURNS_SCALE_HEIGHT,
  DEFAULT_KEN_BURNS_SCALE_WIDTH,
  DEFAULT_KEN_BURNS_ZOOM_STEP,
  kenBurnsFilter,
} from './ffmpeg/ken-burns-clip';
export type { BuildKenBurnsClipOptions } from './ffmpeg/ken-burns-clip';

export { concatVideoClips } from './ffmpeg/concat-video-clips';
export type { ConcatVideoClipsOptions } from './ffmpeg/concat-video-clips';

export {
  concatSpeechFilterGraph,
  concatSpeechSegments,
  DEFAULT_CONCAT_SPEECH_CHANNELS,
  DEFAULT_CONCAT_SPEECH_SAMPLE_RATE,
} from './ffmpeg/concat-speech-segments';
export type { ConcatSpeechSegmentsOptions } from './ffmpeg/concat-speech-segments';
export { placeSpeechFilterGraph, placeSpeechSegments } from './ffmpeg/place-speech-segments';
export type {
  PlaceSpeechSegmentsOptions,
  SpeechSegmentPlacement,
} from './ffmpeg/place-speech-segments';

export { gainDbToVolume } from './mix/gain-db-to-volume';
export {
  buildGainAutomationCurve,
  evaluateGainAutomationCurve,
} from './mix/gain-automation-curve';
export type { GainAutomationCurve, GainAutomationSegment } from './mix/gain-automation-curve';
export { buildGainAutomationExpression } from './mix/build-gain-automation-expression';
export { buildVoiceChain } from './mix/build-voice-chain';
export { buildMusicBedChain } from './mix/build-music-bed-chain';
export type { MusicBedChainOptions } from './mix/build-music-bed-chain';
export { buildAudioMixGraph } from './mix/build-audio-mix-graph';
export type { AudioMixGraphSpec } from './mix/build-audio-mix-graph';
export { shiftTimelineAudioForBumpers } from './mix/shift-timeline-audio-for-bumpers';
export { serializeFilterGraph } from './mix/serialize-filter-graph';
export type { FilterChain, FilterGraph } from './mix/filter-graph';
export { audioMixFfmpegArgs } from './mix/audio-mix-ffmpeg-args';
export {
  AUDIO_MIX_CHANNELS,
  AUDIO_MIX_CODEC,
  AUDIO_MIX_SAMPLE_RATE,
} from './mix/audio-mix-format';
export { UnresolvedAudioAssetError } from './errors/unresolved-audio-asset-error';

export { mixTimelineAudio } from './ffmpeg/mix-timeline-audio';
export type { MixTimelineAudioOptions, MixTimelineAudioResult } from './ffmpeg/mix-timeline-audio';

export {
  MIX_INTEGRATED_TOLERANCE_LU,
  MIX_TRUE_PEAK_TOLERANCE_DB,
  verifyMixLoudness,
} from './ffmpeg/verify-mix-loudness';
export type { MixLoudnessVerification, VerifyMixLoudnessOptions } from './ffmpeg/verify-mix-loudness';

export { MUX_AUDIO_BITRATE, MUX_AUDIO_CODEC, muxAudioIntoVideo } from './ffmpeg/mux-audio-into-video';
export type { MuxAudioIntoVideoOptions, MuxAudioIntoVideoResult } from './ffmpeg/mux-audio-into-video';

export { MissingMediaStreamError } from './errors/missing-media-stream-error';
export type { MissingStreamKind } from './errors/missing-media-stream-error';

export { MASTER_BUS_TRUE_PEAK_MARGIN_DB } from './ffmpeg/master-bus-limiter';

export {
  buildMasterNormalizationGraph,
  MASTER_NORMALIZATION_TOLERANCE_LU,
  needsMasterNormalization,
  normalizeMasterLoudness,
} from './ffmpeg/normalize-master-loudness';
export type {
  NormalizeMasterLoudnessOptions,
  NormalizeMasterLoudnessResult,
} from './ffmpeg/normalize-master-loudness';
export { normalizeVideoMasterLoudness, videoMasterNormalizationArgs } from './ffmpeg/normalize-video-master-loudness';
export { audioGainArgs, normalizeAudioLoudness } from './ffmpeg/normalize-audio-loudness';
export type { NormalizeAudioLoudnessResult } from './ffmpeg/normalize-audio-loudness';

export { parseWhisperCppJson } from './whisper/parse-whisper-cpp-json';
export type { ParseTranscriptionOptions } from './whisper/parse-whisper-cpp-json';
export { parseFasterWhisperJson } from './whisper/parse-faster-whisper-json';
export { transcribeWithWhisperCpp } from './whisper/transcribe-with-whisper-cpp';
export type { TranscribeWithWhisperCppOptions } from './whisper/transcribe-with-whisper-cpp';

export type {
  AssetId,
  Ms,
  MediaAsset,
  MediaKind,
  SilenceRange,
  Transcription,
  TranscriptionEngine,
  VoiceTarget,
  Word,
} from '@video-maker/timeline-core';

export { measureSegmentLoudness, parseEbur128IntegratedLufs, segmentLoudnessArgs } from './ffmpeg/measure-segment-loudness';
export type { MeasureSegmentLoudnessOptions } from './ffmpeg/measure-segment-loudness';
export {
  blackDetectArgs,
  DEFAULT_BLACK_PIXEL_THRESHOLD,
  DEFAULT_FREEZE_NOISE_DB,
  detectBlackSegments,
  detectFrozenSegments,
  freezeDetectArgs,
  parseBlackDetect,
  parseFreezeDetect,
} from './ffmpeg/detect-video-defects';
export type { DetectBlackSegmentsOptions, DetectFrozenSegmentsOptions } from './ffmpeg/detect-video-defects';
export { detectSilences, parseSilenceSegments, silenceDetectArgs } from './ffmpeg/detect-silence-segments';
export type { DetectSilencesOptions } from './ffmpeg/detect-silence-segments';
export type { DetectedSegment, TimeSegment } from './ffmpeg/time-segment';
