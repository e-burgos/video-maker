import { isAbsolute, join } from 'node:path/posix';

import { PipelineStageError } from '../errors/pipeline-stage-error';

export const MEDIA_ROOT_ENV_VAR = 'RENDER_API_MEDIA_ROOT';
export const MAX_UPLOAD_BYTES_ENV_VAR = 'RENDER_API_MAX_UPLOAD_BYTES';
export const OBJECT_STORE_ENV_VAR = 'RENDER_API_OBJECT_STORE';

export const DEFAULT_MEDIA_ROOT = 'media';
export const DEFAULT_MAX_UPLOAD_BYTES = 2_147_483_648;
export const OBJECT_STORE_KINDS = ['fs'] as const;

export type ObjectStoreKind = (typeof OBJECT_STORE_KINDS)[number];

export interface StoreConfig {
  readonly mediaRoot: string;
  readonly maxUploadBytes: number;
  readonly objectStore: ObjectStoreKind;
}

function readMediaRoot(env: NodeJS.ProcessEnv, cwd: string): string {
  const value = env[MEDIA_ROOT_ENV_VAR];
  const mediaRoot = value !== undefined && value !== '' ? value : DEFAULT_MEDIA_ROOT;
  return isAbsolute(mediaRoot) ? mediaRoot : join(cwd, mediaRoot);
}

function readMaxUploadBytes(env: NodeJS.ProcessEnv): number {
  const raw = env[MAX_UPLOAD_BYTES_ENV_VAR];
  if (raw === undefined || raw === '') {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: MAX_UPLOAD_BYTES_ENV_VAR,
      expected: 'a positive integer number of bytes',
    });
  }

  return parsed;
}

function readObjectStore(env: NodeJS.ProcessEnv): ObjectStoreKind {
  const value = env[OBJECT_STORE_ENV_VAR];
  if (value === undefined || value === '') {
    return 'fs';
  }

  if (!OBJECT_STORE_KINDS.includes(value as ObjectStoreKind)) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: OBJECT_STORE_ENV_VAR,
      expected: 'fs',
    });
  }

  return value as ObjectStoreKind;
}

export function readStoreConfig(env: NodeJS.ProcessEnv, cwd: string): StoreConfig {
  return {
    mediaRoot: readMediaRoot(env, cwd),
    maxUploadBytes: readMaxUploadBytes(env),
    objectStore: readObjectStore(env),
  };
}
