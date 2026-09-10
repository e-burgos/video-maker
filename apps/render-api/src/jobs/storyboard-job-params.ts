import { PipelineStageError } from '../errors/pipeline-stage-error';

const DEFAULT_STORYBOARD_OVERWRITE = false;

export interface StoryboardJobInput {
  readonly brief: string | null;
  readonly scriptText: string | null;
}

function readText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INPUT_INVALID',
      stage: null,
      resource: field,
      expected: 'a non-empty string',
    });
  }

  return value.trim();
}

export function parseStoryboardInput(body: Readonly<Record<string, unknown>>): StoryboardJobInput {
  const brief = readText(body.brief, 'brief');
  const scriptText = readText(body.scriptText, 'scriptText');

  if (brief === null && scriptText === null) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INPUT_INVALID',
      stage: null,
      expected: 'exactly one of brief or scriptText',
    });
  }

  if (brief !== null && scriptText !== null) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INPUT_INVALID',
      stage: null,
      expected: 'exactly one of brief or scriptText, never both',
    });
  }

  return { brief, scriptText };
}

export function parseStoryboardOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_STORYBOARD_OVERWRITE;
  }

  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'STORYBOARD_OVERWRITE_INVALID',
      stage: null,
      expected: 'a boolean',
    });
  }

  return value;
}
