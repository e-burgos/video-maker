import { brandImageFile, parseBrandManifest, storyboardSceneImageRefs } from '@video-maker/motion-graphics';
import type { BrandManifest, MotionStoryboard } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';

const LOCAL_PREFIX = 'images/';
const BRAND_PREFIX = 'brand:';

export const ACCEPTED_IMAGE_REF_FORMAT = 'images/<file in raw/images> or brand:<key>';

export interface StoryboardImageProblem {
  readonly sceneId: string;
  readonly ref: string;
}

export interface AvailableImageRefs {
  readonly local: readonly string[];
  readonly brand: readonly string[];
}

export function describeAvailableImageRefs(available: AvailableImageRefs): string {
  const refs = [...available.local.map((file) => `${LOCAL_PREFIX}${file}`), ...available.brand.map((key) => `${BRAND_PREFIX}${key}`)];
  return refs.length === 0 ? 'none' : refs.join(', ');
}

export function describeImageProblem(problem: StoryboardImageProblem, available: AvailableImageRefs): string {
  return `scene "${problem.sceneId}": image "${problem.ref}" must be ${ACCEPTED_IMAGE_REF_FORMAT}; available: ${describeAvailableImageRefs(available)}`;
}

export function parseBrandIfValid(manifest: unknown): BrandManifest | null {
  try {
    return parseBrandManifest(manifest);
  } catch {
    return null;
  }
}

export async function listRawImages(storage: ObjectStorage, rawDir: string): Promise<readonly string[]> {
  const entries = await storage.listDirectory(join(rawDir, 'images'));
  return (entries ?? []).filter((entry) => entry.isFile).map((entry) => entry.name).sort();
}

function isSafeFileName(name: string): boolean {
  return name !== '' && !name.includes('/') && !name.includes('..');
}

function isAvailable(ref: string, available: AvailableImageRefs, brand: BrandManifest | null): boolean {
  if (ref.startsWith(LOCAL_PREFIX)) {
    const file = ref.slice(LOCAL_PREFIX.length);
    return isSafeFileName(file) && available.local.includes(file);
  }
  if (ref.startsWith(BRAND_PREFIX)) {
    return brand !== null && brandImageFile(brand, ref.slice(BRAND_PREFIX.length)) !== undefined;
  }
  return false;
}

export function findStoryboardImageProblem(
  storyboard: MotionStoryboard,
  available: AvailableImageRefs,
  brand: BrandManifest | null,
): StoryboardImageProblem | null {
  for (const scene of storyboard.scenes) {
    const ref = storyboardSceneImageRefs(scene).find((candidate) => !isAvailable(candidate, available, brand));
    if (ref !== undefined) {
      return { sceneId: scene.id, ref };
    }
  }
  return null;
}

export function availableImageRefs(local: readonly string[], brand: BrandManifest | null): AvailableImageRefs {
  return { local, brand: brand === null ? [] : Object.keys(brand.images).sort() };
}
