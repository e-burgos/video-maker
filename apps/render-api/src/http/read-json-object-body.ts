import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { HttpRequestLine } from './http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from './read-json-body';

export async function readJsonObjectBody(request: HttpRequestLine): Promise<Record<string, unknown>> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind !== 'parsed' || typeof bodyResult.value !== 'object' || bodyResult.value === null) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }
  return bodyResult.value as Record<string, unknown>;
}
