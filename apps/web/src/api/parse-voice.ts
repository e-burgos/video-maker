import { isVoiceTrackSource } from './parse-render-job';
import { VOICE_ENGINES, VOICE_QUALITIES } from './render-api-types';
import { responseShapeUnexpected } from './render-api-error';
import type {
  ElevenLabsKeyResult,
  ElevenLabsVoicesSettings,
  VoiceDocument,
  VoiceListing,
  VoiceManifest,
  VoiceSceneStatus,
  VoiceSceneWriteResult,
  VoiceTrack,
} from './render-api-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVoiceLanguage(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    (value['region'] === null || typeof value['region'] === 'string')
  );
}

function isVoiceQuality(value: unknown): boolean {
  return value === null || (VOICE_QUALITIES as readonly unknown[]).includes(value);
}

function hasLocalModelFiles(value: Record<string, unknown>): boolean {
  return (
    value['engine'] !== 'piper' ||
    (typeof value['directory'] === 'string' &&
      typeof value['fileName'] === 'string' &&
      isVoiceQuality(value['quality']))
  );
}

function isVoiceModel(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    (VOICE_ENGINES as readonly unknown[]).includes(value['engine']) &&
    hasLocalModelFiles(value) &&
    typeof value['isDefault'] === 'boolean' &&
    isVoiceLanguage(value['language']) &&
    typeof value['label'] === 'string' &&
    typeof value['description'] === 'string' &&
    typeof value['previewUrl'] === 'string'
  );
}

function isVoiceTrack(value: unknown): value is VoiceTrack {
  return (
    isRecord(value) &&
    typeof value['sceneId'] === 'string' &&
    typeof value['index'] === 'number' &&
    isVoiceTrackSource(value['source']) &&
    typeof value['path'] === 'string' &&
    typeof value['wordsPath'] === 'string' &&
    typeof value['durationMs'] === 'number' &&
    typeof value['sampleRate'] === 'number' &&
    (value['voiceId'] === null || typeof value['voiceId'] === 'string') &&
    typeof value['narrationHash'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}

function isVoiceManifest(value: unknown): value is VoiceManifest {
  return (
    isRecord(value) &&
    typeof value['schemaVersion'] === 'number' &&
    typeof value['storyboardId'] === 'string' &&
    typeof value['language'] === 'string' &&
    Array.isArray(value['tracks']) &&
    value['tracks'].every(isVoiceTrack)
  );
}

function isVoiceSceneStatus(value: unknown): value is VoiceSceneStatus {
  return (
    isRecord(value) &&
    typeof value['sceneId'] === 'string' &&
    typeof value['index'] === 'number' &&
    isVoiceTrackSource(value['source']) &&
    (value['stale'] === null || typeof value['stale'] === 'boolean')
  );
}

export function parseVoiceListing(value: unknown): VoiceListing {
  if (!isRecord(value) || !Array.isArray(value['voices']) || !value['voices'].every(isVoiceModel)) {
    throw responseShapeUnexpected(200, 'a voice listing');
  }

  return value as VoiceListing;
}

export function parseVoiceDocument(value: unknown): VoiceDocument {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    !isVoiceManifest(value['manifest']) ||
    !Array.isArray(value['scenes']) ||
    !value['scenes'].every(isVoiceSceneStatus)
  ) {
    throw responseShapeUnexpected(200, 'a voice document');
  }

  return value as VoiceDocument;
}

export function parseVoiceSceneWriteResult(value: unknown): VoiceSceneWriteResult {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    typeof value['path'] !== 'string' ||
    !isVoiceTrack(value['track'])
  ) {
    throw responseShapeUnexpected(200, 'a voice scene write result');
  }

  return value as VoiceSceneWriteResult;
}

function isElevenLabsVoiceEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    typeof value['description'] === 'string'
  );
}

export function parseElevenLabsVoicesSettings(value: unknown): ElevenLabsVoicesSettings {
  if (
    !isRecord(value) ||
    typeof value['keyConfigured'] !== 'boolean' ||
    !Array.isArray(value['voices']) ||
    !value['voices'].every(isElevenLabsVoiceEntry)
  ) {
    throw responseShapeUnexpected(200, 'elevenlabs voice settings');
  }
  return value as ElevenLabsVoicesSettings;
}

export function parseElevenLabsKeyResult(value: unknown): ElevenLabsKeyResult {
  if (!isRecord(value) || typeof value['keyConfigured'] !== 'boolean' || typeof value['tier'] !== 'string') {
    throw responseShapeUnexpected(200, 'an elevenlabs key result');
  }
  return value as ElevenLabsKeyResult;
}

export function parseElevenLabsVoicesWriteResult(value: unknown): { voices: ElevenLabsVoicesSettings['voices'] } {
  if (!isRecord(value) || !Array.isArray(value['voices']) || !value['voices'].every(isElevenLabsVoiceEntry)) {
    throw responseShapeUnexpected(200, 'an elevenlabs voices result');
  }
  return value as { voices: ElevenLabsVoicesSettings['voices'] };
}
