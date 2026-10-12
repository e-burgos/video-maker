import { serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { VoiceScriptDirectionsSchema } from '@video-maker/timeline-core';
import type { VoiceScriptDirections } from '@video-maker/timeline-core';
import { dirname } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { voiceDirectionPath } from './voice-paths';

export type VoiceDirections = Readonly<VoiceScriptDirections>;

function invalidDirections(expected: string): PipelineStageError {
  return new PipelineStageError({
    code: 'INVALID_INPUT',
    stage: null,
    resource: voiceDirectionPath(),
    expected,
  });
}

export function parseVoiceDirections(value: unknown): VoiceDirections {
  const parsed = VoiceScriptDirectionsSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidDirections(
      `an object keyed by script line number with voice directions: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

export async function readVoiceDirections(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<VoiceDirections> {
  const absolutePath = toAbsolutePath(project, voiceDirectionPath());
  if ((await deps.storage.stat(absolutePath)) === null) {
    return {};
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await deps.storage.readTextFile(absolutePath));
  } catch {
    throw invalidDirections('valid JSON');
  }
  return parseVoiceDirections(raw);
}

export async function writeVoiceDirections(
  deps: RenderApiDependencies,
  project: MediaProject,
  directions: VoiceDirections,
): Promise<string> {
  const relativePath = voiceDirectionPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  await deps.storage.ensureDirectory(dirname(absolutePath));
  await deps.storage.writeTextFile(absolutePath, serializeMontageDocument(parseVoiceDirections(directions)));

  return relativePath;
}
