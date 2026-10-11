import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isPortableFileName } from '../store/asset-path';

const REVIEW_FILE_PATTERN = /^out\/([^/]+\.mp4)$/u;
export const REVIEW_FILE_SUFFIX = '.review.json';

export interface ReviewJobInput {
  readonly file: string;
}

function invalidFile(): PipelineStageError {
  return new PipelineStageError({
    code: 'REVIEW_FILE_INVALID',
    stage: null,
    resource: 'file',
    expected: 'a project-relative path of an .mp4 directly under out/',
  });
}

export function parseReviewFile(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidFile();
  }
  const name = REVIEW_FILE_PATTERN.exec(value)?.[1];
  if (name === undefined || !isPortableFileName(name)) {
    throw invalidFile();
  }
  return value;
}

export function reviewFileFor(videoFile: string): string {
  return `${videoFile.slice(0, -'.mp4'.length)}${REVIEW_FILE_SUFFIX}`;
}

export function parseReviewJobInput(body: Readonly<Record<string, unknown>>): ReviewJobInput {
  return { file: parseReviewFile(body.file) };
}
