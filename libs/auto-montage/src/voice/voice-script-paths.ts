import type { ProjectRelativePath } from '../project/project-paths';
import { workPath } from '../project/project-paths';

export const VOICE_DIRECTORY_NAME = 'voice';
export const VOICE_SCRIPT_TRACK_ID = 'voice';
export const VOICE_SCRIPT_MANIFEST_FILE_NAME = 'script-manifest.json';

export function voiceDirectoryPath(): ProjectRelativePath {
  return workPath(VOICE_DIRECTORY_NAME);
}

export function voiceTrackPath(trackId: string): ProjectRelativePath {
  return workPath(VOICE_DIRECTORY_NAME, `${trackId}.wav`);
}

export function voiceWordsPath(trackId: string): ProjectRelativePath {
  return workPath(VOICE_DIRECTORY_NAME, `${trackId}.words.json`);
}

export function voiceScriptTrackPath(): ProjectRelativePath {
  return voiceTrackPath(VOICE_SCRIPT_TRACK_ID);
}

export function voiceScriptWordsPath(): ProjectRelativePath {
  return voiceWordsPath(VOICE_SCRIPT_TRACK_ID);
}

export function voiceScriptManifestPath(): ProjectRelativePath {
  return workPath(VOICE_DIRECTORY_NAME, VOICE_SCRIPT_MANIFEST_FILE_NAME);
}
