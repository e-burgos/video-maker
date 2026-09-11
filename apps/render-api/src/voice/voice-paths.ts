import { VOICE_DIRECTORY_NAME, workPath } from '@video-maker/auto-montage';

export {
  VOICE_DIRECTORY_NAME,
  VOICE_SCRIPT_MANIFEST_FILE_NAME,
  VOICE_SCRIPT_TRACK_ID,
  voiceDirectoryPath,
  voiceScriptManifestPath,
  voiceScriptTrackPath,
  voiceScriptWordsPath,
  voiceTrackPath,
  voiceWordsPath,
} from '@video-maker/auto-montage';

export const VOICE_MANIFEST_FILE_NAME = 'manifest.json';
export const VOICE_SOURCES_DIRECTORY_NAME = 'sources';
export const VOICE_WHISPER_DIRECTORY_NAME = 'whisper';

export function voiceManifestPath(): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_MANIFEST_FILE_NAME);
}

export function voiceSourcesDirectoryPath(): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_SOURCES_DIRECTORY_NAME);
}

export function voiceNarrationTextPath(sceneId: string): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_SOURCES_DIRECTORY_NAME, `${sceneId}.txt`);
}

export function voiceSourceWavPath(sceneId: string): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_SOURCES_DIRECTORY_NAME, `${sceneId}.wav`);
}

export function voiceWhisperDirectoryPath(): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_WHISPER_DIRECTORY_NAME);
}

export function voiceWhisperWavPath(sceneId: string): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_WHISPER_DIRECTORY_NAME, `${sceneId}.wav`);
}

export function voiceScriptLineId(index: number): string {
  return `line-${String(index).padStart(2, '0')}`;
}

export function voiceWhisperOutBase(sceneId: string): string {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_WHISPER_DIRECTORY_NAME, sceneId);
}
