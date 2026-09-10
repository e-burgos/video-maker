import { PipelineStageError } from '../errors/pipeline-stage-error';

const DEFAULT_VOICE_OVERWRITE = false;

export interface VoiceJobInput {
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
  readonly overwrite: boolean;
}

export function parseVoiceId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PipelineStageError({
      code: 'VOICE_ID_INVALID',
      stage: null,
      resource: 'voice',
      expected: 'a non-empty voice model id',
    });
  }

  return value.trim();
}

export function parseVoiceSceneIds(value: unknown): readonly string[] | null {
  if (value === undefined || value === null) {
    return null;
  }

  const isNonEmptyStringArray =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);

  if (!isNonEmptyStringArray) {
    throw new PipelineStageError({
      code: 'VOICE_SCENE_IDS_INVALID',
      stage: null,
      resource: 'sceneIds',
      expected: 'a non-empty array of scene ids',
    });
  }

  const sceneIds = (value as readonly string[]).map((entry) => entry.trim());

  if (new Set(sceneIds).size !== sceneIds.length) {
    throw new PipelineStageError({
      code: 'VOICE_SCENE_IDS_INVALID',
      stage: null,
      resource: 'sceneIds',
      expected: 'scene ids without duplicates',
    });
  }

  return sceneIds;
}

export function parseVoiceOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_VOICE_OVERWRITE;
  }

  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'VOICE_OVERWRITE_INVALID',
      stage: null,
      resource: 'overwrite',
      expected: 'a boolean',
    });
  }

  return value;
}

export function parseVoiceJobInput(body: Readonly<Record<string, unknown>>): VoiceJobInput {
  return {
    voiceId: parseVoiceId(body.voice),
    sceneIds: parseVoiceSceneIds(body.sceneIds),
    overwrite: parseVoiceOverwrite(body.overwrite),
  };
}
