import { DEFAULT_VOICE_SCRIPT_GAP_MS } from '@video-maker/timeline-core';

import { PipelineStageError } from '../errors/pipeline-stage-error';

const DEFAULT_VOICE_OVERWRITE = false;

export interface VoiceScriptInput {
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
}

export interface VoiceJobInput extends VoiceScriptInput {
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

function scriptInvalid(resource: string | null, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'VOICE_SCRIPT_INVALID', stage: null, resource, expected });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseVoiceScriptInput(
  body: Readonly<Record<string, unknown>>,
  sceneIds: readonly string[] | null,
): VoiceScriptInput {
  const rawText = body.scriptText;
  const rawPath = body.scriptPath;

  if (rawText !== undefined && rawPath !== undefined) {
    throw scriptInvalid(null, 'at most one of scriptText or scriptPath');
  }

  if (rawText !== undefined && !isNonEmptyString(rawText)) {
    throw scriptInvalid('scriptText', 'a non-empty script, one sentence per line');
  }

  if (rawPath !== undefined && !isNonEmptyString(rawPath)) {
    throw scriptInvalid('scriptPath', 'a non-empty project-relative path to the script');
  }

  const scriptText = isNonEmptyString(rawText) ? rawText : null;
  const scriptPath = isNonEmptyString(rawPath) ? rawPath : null;
  const isScriptMode = scriptText !== null || scriptPath !== null;

  if (isScriptMode && sceneIds !== null) {
    throw scriptInvalid('sceneIds', 'sceneIds only with the storyboard input, never with a script');
  }

  if (body.gapMs !== undefined && !isScriptMode) {
    throw scriptInvalid('gapMs', 'gapMs only with scriptText or scriptPath');
  }

  if (
    body.gapMs !== undefined &&
    (typeof body.gapMs !== 'number' || !Number.isInteger(body.gapMs) || body.gapMs < 0)
  ) {
    throw scriptInvalid('gapMs', 'a non-negative integer number of milliseconds');
  }

  return {
    scriptText,
    scriptPath,
    gapMs: typeof body.gapMs === 'number' ? body.gapMs : DEFAULT_VOICE_SCRIPT_GAP_MS,
  };
}

export function parseVoiceJobInput(body: Readonly<Record<string, unknown>>): VoiceJobInput {
  const sceneIds = parseVoiceSceneIds(body.sceneIds);

  return {
    voiceId: parseVoiceId(body.voice),
    sceneIds,
    overwrite: parseVoiceOverwrite(body.overwrite),
    ...parseVoiceScriptInput(body, sceneIds),
  };
}
