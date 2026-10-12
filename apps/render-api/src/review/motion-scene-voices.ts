import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { z } from 'zod';

import type { ReviewStoragePort } from './review-facts';
import { fileExists } from './review-facts';

export const MOTION_STORYBOARD_PATH = workPath('motion', 'storyboard.json');

const StoryboardVoicesSchema = z.object({
  scenes: z.array(z.object({ id: z.string().min(1), vo: z.string().optional() })),
});

export async function readMotionSceneVoices(project: MediaProject, storage: ReviewStoragePort): Promise<Map<string, string>> {
  const path = toAbsolutePath(project, MOTION_STORYBOARD_PATH);
  const voices = new Map<string, string>();
  if (!(await fileExists(storage, path))) {
    return voices;
  }
  try {
    const parsed = StoryboardVoicesSchema.safeParse(JSON.parse(await storage.readTextFile(path)));
    for (const scene of parsed.success ? parsed.data.scenes : []) {
      if (scene.vo !== undefined && scene.vo.trim().length > 0) {
        voices.set(scene.id, scene.vo.trim());
      }
    }
  } catch {
    return voices;
  }
  return voices;
}
