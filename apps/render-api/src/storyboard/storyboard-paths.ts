import { workPath } from '@video-maker/auto-montage';

export const STORYBOARD_FILE_NAME = 'storyboard.json';

export function storyboardPath(): string {
  return workPath(STORYBOARD_FILE_NAME);
}
