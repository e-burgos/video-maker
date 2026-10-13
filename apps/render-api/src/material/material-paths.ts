import { workPath } from '@video-maker/auto-montage';

export const MATERIAL_REVIEW_FILE_NAME = 'material-review.json';
export const VIEWED_IMAGES_FILE_NAME = 'viewed-images.json';

export function materialReviewPath(): string {
  return workPath('producer', MATERIAL_REVIEW_FILE_NAME);
}

export function viewedImagesPath(): string {
  return workPath('producer', VIEWED_IMAGES_FILE_NAME);
}
