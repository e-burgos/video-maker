export const VOICE_SYNTH_CACHE_DIR_ENV_VAR = 'VOICE_SYNTH_CACHE_DIR';

export const ELEVENLABS_CACHE_RELATIVE_DIR = '.cache/video-maker/elevenlabs';

export function readElevenLabsCacheDirectory(env: NodeJS.ProcessEnv, homeDirectory: string): string {
  const configured = env[VOICE_SYNTH_CACHE_DIR_ENV_VAR];
  return configured === undefined || configured === ''
    ? `${homeDirectory}/${ELEVENLABS_CACHE_RELATIVE_DIR}`
    : configured;
}
