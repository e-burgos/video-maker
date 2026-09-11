import { serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { VoiceManifestSchema, VoiceScriptManifestSchema } from '@video-maker/timeline-core';
import type { Transcription, VoiceManifest, VoiceScriptManifest } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { voiceDirectoryPath, voiceManifestPath, voiceScriptManifestPath } from './voice-paths';

const EXPECTED_DOCUMENT = 'a document accepted by VoiceManifestSchema';

export function parseVoiceManifest(value: unknown, relativePath: string): VoiceManifest {
  const result = VoiceManifestSchema.safeParse(value);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'VOICE_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }
  return result.data;
}

export async function readStoredVoiceManifest(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<VoiceManifest> {
  const relativePath = voiceManifestPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  if ((await deps.storage.stat(absolutePath)) === null) {
    throw new PipelineStageError({ code: 'VOICE_NOT_FOUND', stage: null, resource: relativePath });
  }

  const raw = await deps.storage.readTextFile(absolutePath);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new PipelineStageError({
      code: 'VOICE_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }

  return parseVoiceManifest(parsedJson, relativePath);
}

export async function readVoiceManifestIfUsable(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<VoiceManifest | null> {
  try {
    return await readStoredVoiceManifest(deps, project);
  } catch {
    return null;
  }
}

export async function writeVoiceManifest(
  deps: RenderApiDependencies,
  project: MediaProject,
  manifest: VoiceManifest,
): Promise<string> {
  const relativePath = voiceManifestPath();

  await deps.storage.ensureDirectory(toAbsolutePath(project, voiceDirectoryPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(parseVoiceManifest(manifest, relativePath)),
  );

  return relativePath;
}

export async function writeVoiceWords(
  deps: RenderApiDependencies,
  project: MediaProject,
  relativePath: string,
  transcription: Transcription,
): Promise<string> {
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(transcription),
  );
  return relativePath;
}

const EXPECTED_SCRIPT_DOCUMENT = 'a document accepted by VoiceScriptManifestSchema';

export function parseVoiceScriptManifest(value: unknown, relativePath: string): VoiceScriptManifest {
  const result = VoiceScriptManifestSchema.safeParse(value);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'VOICE_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_SCRIPT_DOCUMENT,
    });
  }
  return result.data;
}

export async function writeVoiceScriptManifest(
  deps: RenderApiDependencies,
  project: MediaProject,
  manifest: VoiceScriptManifest,
): Promise<string> {
  const relativePath = voiceScriptManifestPath();

  await deps.storage.ensureDirectory(toAbsolutePath(project, voiceDirectoryPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(parseVoiceScriptManifest(manifest, relativePath)),
  );

  return relativePath;
}
