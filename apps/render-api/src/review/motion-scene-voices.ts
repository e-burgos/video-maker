import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { z } from 'zod';

import type { ReviewStoragePort } from './review-facts';
import { fileExists } from './review-facts';

export const MOTION_VOICE_MANIFEST_PATH = workPath('motion', 'voice-manifest.json');
export const MOTION_STORYBOARD_PATH = 'motion/storyboard.json';

const VoiceManifestSchema = z.record(z.string(), z.object({ vo: z.string().optional() }));

const StoryboardVoicesSchema = z.object({
  scenes: z.array(z.object({ id: z.string().min(1), vo: z.string().optional() })),
});

function voiceEntries(entries: Iterable<readonly [string, string | undefined]>): Map<string, string> {
  const voices = new Map<string, string>();
  for (const [sceneId, vo] of entries) {
    if (vo !== undefined && vo.trim().length > 0) {
      voices.set(sceneId, vo.trim());
    }
  }
  return voices;
}

async function readJson(storage: ReviewStoragePort, path: string): Promise<unknown> {
  if (!(await fileExists(storage, path))) {
    return null;
  }
  try {
    return JSON.parse(await storage.readTextFile(path));
  } catch {
    return null;
  }
}

async function readVoicedLines(project: MediaProject, storage: ReviewStoragePort): Promise<Map<string, string>> {
  const parsed = VoiceManifestSchema.safeParse(await readJson(storage, toAbsolutePath(project, MOTION_VOICE_MANIFEST_PATH)));
  return parsed.success ? voiceEntries(Object.entries(parsed.data).map(([id, entry]) => [id, entry.vo] as const)) : new Map();
}

async function readStoryboardLines(project: MediaProject, storage: ReviewStoragePort): Promise<Map<string, string>> {
  const parsed = StoryboardVoicesSchema.safeParse(await readJson(storage, toAbsolutePath(project, MOTION_STORYBOARD_PATH)));
  return parsed.success ? voiceEntries(parsed.data.scenes.map((scene) => [scene.id, scene.vo] as const)) : new Map();
}

export async function readMotionSceneVoices(project: MediaProject, storage: ReviewStoragePort): Promise<Map<string, string>> {
  const voiced = await readVoicedLines(project, storage);
  return voiced.size > 0 ? voiced : readStoryboardLines(project, storage);
}
