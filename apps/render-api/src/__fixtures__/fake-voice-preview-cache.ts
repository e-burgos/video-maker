import type { VoicePreviewCache, VoicePreviewCacheStat } from '../deps/render-api-dependencies';
import type { CallLog } from './call-log';

export const FAKE_VOICE_PREVIEW_DIRECTORY = '/tmp/video-maker-voice-previews';

export interface FakeVoicePreviewCache extends VoicePreviewCache {
  readonly writeBinary: (path: string, sizeBytes: number, modifiedAtMs?: number) => void;
  readonly textFiles: ReadonlyMap<string, string>;
  readonly createdDirectories: readonly string[];
}

export function createFakeVoicePreviewCache(
  callLog: CallLog,
  directory: string = FAKE_VOICE_PREVIEW_DIRECTORY,
): FakeVoicePreviewCache {
  const stats = new Map<string, VoicePreviewCacheStat>();
  const textFiles = new Map<string, string>();
  const createdDirectories: string[] = [];

  return {
    directory,
    textFiles,
    createdDirectories,
    writeBinary: (path, sizeBytes, modifiedAtMs = 1) => {
      stats.set(path, { sizeBytes, modifiedAtMs });
    },
    ensureDirectory: async (path) => {
      callLog.record('voicePreviewCache.ensureDirectory', path);
      createdDirectories.push(path);
    },
    stat: async (path) => {
      callLog.record('voicePreviewCache.stat', path);
      return stats.get(path) ?? null;
    },
    writeTextFile: async (path, contents) => {
      callLog.record('voicePreviewCache.writeTextFile', path);
      textFiles.set(path, contents);
      stats.set(path, { sizeBytes: contents.length, modifiedAtMs: 1 });
    },
    openReadStream: async function* openReadStream(path) {
      callLog.record('voicePreviewCache.openReadStream', path);
      yield new TextEncoder().encode(`wav:${path}`);
    },
  };
}
