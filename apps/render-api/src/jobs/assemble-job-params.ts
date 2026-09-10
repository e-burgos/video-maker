import { PipelineStageError } from '../errors/pipeline-stage-error';

const DEFAULT_ASSEMBLE_OVERWRITE = false;

export interface AssembleJobInput {
  readonly musicAssetId: string | null;
  readonly scenePaddingMs: number | null;
  readonly overwrite: boolean;
}

export function parseAssembleMusicAssetId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PipelineStageError({
      code: 'ASSEMBLE_MUSIC_INVALID',
      stage: null,
      resource: 'music',
      expected: 'a non-empty catalog asset id',
    });
  }

  return value.trim();
}

export function parseScenePaddingMs(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new PipelineStageError({
      code: 'ASSEMBLE_PADDING_INVALID',
      stage: null,
      resource: 'scenePaddingMs',
      expected: 'a non-negative integer number of milliseconds',
    });
  }

  return value;
}

export function parseAssembleOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_ASSEMBLE_OVERWRITE;
  }

  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'ASSEMBLE_OVERWRITE_INVALID',
      stage: null,
      resource: 'overwrite',
      expected: 'a boolean',
    });
  }

  return value;
}

export function parseAssembleJobInput(body: Readonly<Record<string, unknown>>): AssembleJobInput {
  return {
    musicAssetId: parseAssembleMusicAssetId(body.music),
    scenePaddingMs: parseScenePaddingMs(body.scenePaddingMs),
    overwrite: parseAssembleOverwrite(body.overwrite),
  };
}
