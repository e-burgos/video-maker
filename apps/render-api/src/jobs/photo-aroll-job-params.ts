import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isPortableFileName } from '../store/asset-path';

export const DEFAULT_PHOTO_AROLL_FPS = 30;

export interface PhotoArollJobInput {
  readonly photos: readonly string[];
  readonly output: string;
  readonly fps: number;
}

function invalid(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'PHOTO_AROLL_INPUT_INVALID', stage: null, resource, expected });
}

export function parsePhotoArollPhotos(value: unknown): readonly string[] {
  const isValidPhotos =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);

  if (!isValidPhotos) {
    throw invalid('photos', 'a non-empty array of project-relative photo paths under raw/images/');
  }

  return value as readonly string[];
}

export function parsePhotoArollOutput(value: unknown): string {
  if (typeof value !== 'string' || !isPortableFileName(value)) {
    throw invalid('output', 'a single portable file name');
  }
  return value;
}

export function parsePhotoArollFps(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_PHOTO_AROLL_FPS;
  }
  if (value !== DEFAULT_PHOTO_AROLL_FPS) {
    throw invalid('fps', `exactly ${DEFAULT_PHOTO_AROLL_FPS}`);
  }
  return value;
}

export function parsePhotoArollJobInput(body: Readonly<Record<string, unknown>>): PhotoArollJobInput {
  return {
    photos: parsePhotoArollPhotos(body.photos),
    output: parsePhotoArollOutput(body.output),
    fps: parsePhotoArollFps(body.fps),
  };
}
