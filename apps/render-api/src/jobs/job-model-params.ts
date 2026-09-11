import { PipelineStageError } from '../errors/pipeline-stage-error';

export function parseJobModel(value: unknown, allowed: readonly string[]): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new PipelineStageError({
      code: 'JOB_MODEL_INVALID',
      stage: null,
      resource: 'model',
      expected: `one of ${allowed.join(', ')}`,
    });
  }

  return value;
}
