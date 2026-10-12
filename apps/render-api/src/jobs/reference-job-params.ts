import { mediaKindForExtension } from '@video-maker/auto-montage';

import { PipelineStageError } from '../errors/pipeline-stage-error';
import { REFERENCE_RAW_DIRECTORY } from '../reference/reference-paths';
import { isPortableFileName } from '../store/asset-path';

export interface ReferenceJobInput {
  readonly file: string;
}

function invalidFile(): PipelineStageError {
  return new PipelineStageError({
    code: 'REFERENCE_FILE_INVALID',
    stage: null,
    resource: 'file',
    expected: `a project-relative path of a video directly under ${REFERENCE_RAW_DIRECTORY}/`,
  });
}

export function parseReferenceFile(value: unknown): string {
  const prefix = `${REFERENCE_RAW_DIRECTORY}/`;
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    throw invalidFile();
  }
  const name = value.slice(prefix.length);
  if (!isPortableFileName(name) || mediaKindForExtension(name) !== 'video') {
    throw invalidFile();
  }
  return value;
}

export function parseReferenceJobInput(body: Readonly<Record<string, unknown>>): ReferenceJobInput {
  return { file: parseReferenceFile(body.file) };
}
