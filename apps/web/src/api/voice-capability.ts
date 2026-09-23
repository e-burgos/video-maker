import type { ServiceHealth } from './render-api-types';
import type { Blocker } from './blockers';
import type { TranslationKey } from '../i18n/messages-en';

export const VOICE_BINARY_NAMES = [
  'ffmpeg',
  'ffprobe',
  'whisperCli',
  'whisperModel',
  'ttsCli',
  'ttsVoicesDir',
] as const;

export type VoiceBinaryName = (typeof VOICE_BINARY_NAMES)[number];

function isVoiceBinaryName(name: string): name is VoiceBinaryName {
  return (VOICE_BINARY_NAMES as readonly string[]).includes(name);
}

export function voiceBlockers(health: ServiceHealth | null): Blocker[] {
  if (health === null) {
    return [{ key: 'voice.blocker.healthUnknown' }];
  }

  const blockers: Blocker[] = [];

  if (!health.capabilities.voiceQueue) {
    blockers.push({ key: 'voice.blocker.noQueue' });
  }

  health.binaries
    .filter((binary) => isVoiceBinaryName(binary.name) && !binary.resolved)
    .forEach((binary) =>
      blockers.push({
        key: 'voice.blocker.binaryUnresolved',
        params: { name: binary.name, envVar: binary.envVar },
      }),
    );

  return blockers;
}

export function canGenerateVoice(health: ServiceHealth | null): boolean {
  return voiceBlockers(health).length === 0;
}

const VOICE_FAILURE_CODES = [
  'VOICE_MODEL_UNAVAILABLE',
  'VOICE_SYNTHESIS_FAILED',
  'VOICE_TRANSCRIPTION_FAILED',
  'VOICE_ALREADY_EXISTS',
  'VOICE_NOT_FOUND',
  'VOICE_SCENE_NOT_FOUND',
  'VOICE_ASSET_NOT_FOUND',
  'VOICE_INVALID',
  'VOICE_ID_INVALID',
  'VOICE_SCENE_IDS_INVALID',
  'VOICE_OVERWRITE_INVALID',
  'STORYBOARD_NOT_FOUND',
] as const;

type VoiceFailureCode = (typeof VOICE_FAILURE_CODES)[number];

function isVoiceFailureCode(code: string): code is VoiceFailureCode {
  return (VOICE_FAILURE_CODES as readonly string[]).includes(code);
}

export function voiceFailureKey(code: string): TranslationKey | null {
  return isVoiceFailureCode(code) ? (`voiceFailure.${code}` as TranslationKey) : null;
}
