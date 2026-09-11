export const VOICE_PREVIEW_CACHE_DIR_ENV_VAR = 'PIPER_PREVIEW_CACHE_DIR';

export const VOICE_PREVIEW_CACHE_DIR_NAME = 'video-maker-voice-previews';

export interface VoicePreviewConfig {
  readonly cacheDirectory: string;
}

export function readVoicePreviewConfig(
  env: NodeJS.ProcessEnv,
  temporaryDirectory: string,
): VoicePreviewConfig {
  const configured = env[VOICE_PREVIEW_CACHE_DIR_ENV_VAR];

  return {
    cacheDirectory:
      configured === undefined || configured === ''
        ? `${temporaryDirectory}/${VOICE_PREVIEW_CACHE_DIR_NAME}`
        : configured,
  };
}
