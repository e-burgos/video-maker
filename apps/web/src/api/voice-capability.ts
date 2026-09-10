import type { ServiceHealth } from './render-api-types';

export const VOICE_BINARY_NAMES = [
  'ffmpeg',
  'ffprobe',
  'whisperCli',
  'whisperModel',
  'piperCli',
  'piperModel',
] as const;

export type VoiceBinaryName = (typeof VOICE_BINARY_NAMES)[number];

function isVoiceBinaryName(name: string): name is VoiceBinaryName {
  return (VOICE_BINARY_NAMES as readonly string[]).includes(name);
}

export function voiceBlockers(health: ServiceHealth | null): string[] {
  if (health === null) {
    return ['The render service health is unknown, so no voice-over can be generated.'];
  }

  const blockers: string[] = [];

  if (!health.capabilities.voiceQueue) {
    blockers.push('The render service does not expose a voice queue.');
  }

  health.binaries
    .filter((binary) => isVoiceBinaryName(binary.name) && !binary.resolved)
    .forEach((binary) => blockers.push(`${binary.name} is not resolved (${binary.envVar}).`));

  return blockers;
}

export function canGenerateVoice(health: ServiceHealth | null): boolean {
  return voiceBlockers(health).length === 0;
}

const VOICE_FAILURE_EXPLANATIONS: Readonly<Record<string, string>> = {
  VOICE_MODEL_UNAVAILABLE:
    'Piper is not configured on this machine. Set PIPER_PATH and PIPER_MODEL_PATH in the root .env and restart the render service.',
  VOICE_SYNTHESIS_FAILED:
    'Piper stopped before producing the track of a scene. Try again; if it repeats, run the same narration through piper from a terminal to see what it reports.',
  VOICE_TRANSCRIPTION_FAILED:
    'ffmpeg or whisper-cli failed while aligning a track word by word. The manifest was left untouched, so nothing was half written.',
  VOICE_ALREADY_EXISTS:
    'Those scenes already have a voice track. Regenerating replaces the audio you may have already listened to.',
  VOICE_NOT_FOUND: 'This project has no voice track yet. Generate the voice-over to get started.',
  VOICE_SCENE_NOT_FOUND: 'That scene is not part of the stored storyboard any more.',
  VOICE_ASSET_NOT_FOUND:
    'The recording is not under raw/voice/ of this project. Upload it with the voice role first.',
  VOICE_INVALID:
    'The stored voice manifest does not validate any more, so it cannot be shown. Regenerating the voice-over rewrites it.',
  VOICE_ID_INVALID: 'Pick one of the voices the service listed.',
  VOICE_SCENE_IDS_INVALID: 'The scene ids have to be a non-empty list without duplicates.',
  VOICE_OVERWRITE_INVALID: 'The overwrite flag has to be a boolean.',
  STORYBOARD_NOT_FOUND:
    'There is no storyboard to read the narration from. Propose one on the storyboard page first.',
};

export function voiceFailureExplanation(code: string): string | null {
  return VOICE_FAILURE_EXPLANATIONS[code] ?? null;
}
