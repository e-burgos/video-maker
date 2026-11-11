import { join } from 'node:path';

import { LOCAL_MUSIC_LIST_FILE, localMusicDirectory, parseLocalMusicList } from '@video-maker/motion-graphics';
import type { BrandTrack } from '@video-maker/motion-graphics';

import type { ObjectStorage } from '../deps/object-storage';

export async function readLocalMusicTracks(storage: ObjectStorage, brandsRoot: string, brandId: string): Promise<BrandTrack[]> {
  const listPath = join(localMusicDirectory(brandsRoot, brandId), LOCAL_MUSIC_LIST_FILE);
  if ((await storage.stat(listPath))?.kind !== 'file') {
    return [];
  }
  return parseLocalMusicList(JSON.parse(await storage.readTextFile(listPath)));
}
