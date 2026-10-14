import type { RenderApiDependencies } from '../deps/render-api-dependencies';

export const ELEVENLABS_VOICE_PREFIX = 'elevenlabs:';
export const ELEVENLABS_SECRET_NAME = 'elevenlabs';
export const ELEVENLABS_VOICES_SETTING_KEY = 'voice.elevenlabs.voices';

export interface ElevenLabsVoiceOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export const DEFAULT_ELEVENLABS_VOICES: readonly ElevenLabsVoiceOption[] = [
  {
    id: 'elevenlabs:p7AwDmKvTdoHTBuueGvP',
    label: 'Malena',
    description: 'Rioplatense, cálida y dinámica (ElevenLabs)',
  },
];

export function isElevenLabsVoiceId(voiceId: string): boolean {
  return voiceId.startsWith(ELEVENLABS_VOICE_PREFIX);
}

export function elevenLabsRawVoiceId(voiceId: string): string {
  return isElevenLabsVoiceId(voiceId) ? voiceId.slice(ELEVENLABS_VOICE_PREFIX.length) : voiceId;
}

export function normalizeElevenLabsVoiceId(voiceId: string): string {
  return `${ELEVENLABS_VOICE_PREFIX}${elevenLabsRawVoiceId(voiceId.trim())}`;
}

function isVoiceOption(value: unknown): value is ElevenLabsVoiceOption {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id !== '' &&
    typeof candidate.label === 'string' &&
    typeof candidate.description === 'string'
  );
}

export function readConfiguredElevenLabsVoices(deps: RenderApiDependencies): readonly ElevenLabsVoiceOption[] {
  const stored = deps.localStore.settings.get(ELEVENLABS_VOICES_SETTING_KEY);
  if (!Array.isArray(stored)) {
    return DEFAULT_ELEVENLABS_VOICES;
  }
  return stored.filter(isVoiceOption);
}

export async function isElevenLabsKeyConfigured(deps: RenderApiDependencies): Promise<boolean> {
  return (await deps.secretStore.get(ELEVENLABS_SECRET_NAME)) !== null;
}
