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
export { CommandFailedError, STDERR_MAX_BYTES, truncateStderr } from './errors/command-failed-error';
export { SAMPLE_MAX_CHARS, UnparseableOutputError } from './errors/unparseable-output-error';

export { nodeBinaryLookup } from './fs/binary-lookup';
export type { BinaryLookup } from './fs/binary-lookup';

export {
  BINARY_COMMAND_NAMES,
  BINARY_ENV_VARS,
  resolveBinaries,
  resolveBinary,
} from './binaries/resolve-binaries';
export type { BinaryName, ResolvedBinaries, ResolveBinariesOptions } from './binaries/resolve-binaries';

export { parseSilenceDetect } from './ffmpeg/parse-silence-detect';
export type { ParseSilenceDetectContext } from './ffmpeg/parse-silence-detect';
export {
  DEFAULT_SILENCE_MIN_MS,
  DEFAULT_SILENCE_NOISE_DB,
  detectSilencesWithFfmpeg,
} from './ffmpeg/detect-silences';
export type { DetectSilencesWithFfmpegOptions } from './ffmpeg/detect-silences';

export { systemClock } from './clock';
export type { Clock } from './clock';
export { FFPROBE_ARGS, probeMedia } from './ffprobe/probe-media';
export type { ProbeMediaOptions } from './ffprobe/probe-media';
export { parseFfprobeJson } from './ffprobe/parse-ffprobe-json';
export type { ParseFfprobeContext } from './ffprobe/parse-ffprobe-json';

export {
  DEFAULT_EXTRACT_AUDIO_CHANNELS,
  DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE,
  extractAudioForTranscription,
} from './ffmpeg/extract-audio';
export type { ExtractAudioOptions } from './ffmpeg/extract-audio';

export { DEFAULT_VOICE_TARGET, measureLoudness } from './ffmpeg/measure-loudness';
export type { MeasureLoudnessOptions } from './ffmpeg/measure-loudness';
export { buildLoudnormFilter } from './ffmpeg/build-loudnorm-filter';
export { normalizeVoice } from './ffmpeg/normalize-voice';
export type { NormalizeVoiceOptions, NormalizeVoiceResult } from './ffmpeg/normalize-voice';
export { extractTrailingJsonObject, parseLoudnormJson } from './ffmpeg/parse-loudnorm-json';
export type { LoudnessMeasurement } from './ffmpeg/parse-loudnorm-json';

export { nodeReadTextFile } from './fs/read-text-file';
export type { ReadTextFile } from './fs/read-text-file';

export { groupTokensIntoWords, parseWhisperCppJson } from './whisper/parse-whisper-cpp-json';
export type { ParseTranscriptionOptions } from './whisper/parse-whisper-cpp-json';
export { parseFasterWhisperJson } from './whisper/parse-faster-whisper-json';
export {
  DEFAULT_WHISPER_LANGUAGE,
  transcribeWithWhisperCpp,
} from './whisper/transcribe-with-whisper-cpp';
export type { TranscribeWithWhisperCppOptions } from './whisper/transcribe-with-whisper-cpp';
