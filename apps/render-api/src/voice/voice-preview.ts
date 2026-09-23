import { join } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateVoiceError } from '../errors/translate-voice-error';
import { runVoiceStage } from './voice-synthesis-steps';

export const VOICE_PREVIEW_PHRASE = 'Hola, soy la voz de tu video. Así sueno leyendo tu guion.';

export const VOICE_PREVIEW_REVISION = 'v1';

export const VOICE_PREVIEW_CONTENT_TYPE = 'audio/wav';

export const VOICE_PREVIEW_CACHE_CONTROL = 'public, max-age=86400';

export interface VoicePreviewFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly fromCache: boolean;
}

function previewWavPath(directory: string, voiceId: string): string {
  return join(directory, `${voiceId}.${VOICE_PREVIEW_REVISION}.wav`);
}

function previewTextPath(directory: string, voiceId: string): string {
  return join(directory, `${voiceId}.${VOICE_PREVIEW_REVISION}.txt`);
}

async function modelModifiedAtMs(deps: RenderApiDependencies, modelPath: string): Promise<number> {
  try {
    return (await deps.statFile.statFile(modelPath)).modifiedAtMs;
  } catch (cause) {
    throw translateVoiceError(cause, null, 'tts-voices');
  }
}

export async function buildVoicePreview(
  deps: RenderApiDependencies,
  requestedVoiceId: string,
): Promise<VoicePreviewFile> {
  const voices = await runVoicesLookup(deps);
  const voice = voices.find((candidate) => candidate.id === requestedVoiceId);

  if (voice === undefined) {
    throw new PipelineStageError({
      code: 'VOICE_NOT_FOUND',
      stage: null,
      resource: requestedVoiceId,
      expected: 'a voice model id listed by GET /voices',
    });
  }

  const binaries = await runVoiceStage('synthesize', voice.id, () => deps.resolveVoiceBinaries());
  const voiceDirPath = join(binaries.ttsVoicesDir, voice.directory);
  const modelPath = join(voiceDirPath, voice.fileName);
  const cache = deps.voicePreviewCache;
  const wavPath = previewWavPath(cache.directory, voice.id);

  const cached = await cache.stat(wavPath);
  if (cached !== null && cached.sizeBytes > 0) {
    const modelChangedAtMs = await modelModifiedAtMs(deps, modelPath);
    if (cached.modifiedAtMs >= modelChangedAtMs) {
      return { path: wavPath, sizeBytes: cached.sizeBytes, fromCache: true };
    }
  }

  const textPath = previewTextPath(cache.directory, voice.id);

  await runVoiceStage('synthesize', voice.id, async () => {
    await cache.ensureDirectory(cache.directory);
    await cache.writeTextFile(textPath, `${VOICE_PREVIEW_PHRASE}\n`);
    await deps.synthesizeVoice({
      textPath,
      outPath: wavPath,
      modelPath: voiceDirPath,
      projectRoot: cache.directory,
    });
  });

  const written = await cache.stat(wavPath);
  if (written === null || written.sizeBytes === 0) {
    throw new PipelineStageError({
      code: 'VOICE_SYNTHESIS_FAILED',
      stage: 'synthesize',
      resource: voice.id,
      expected: 'a playable wav preview written to the preview cache',
    });
  }

  return { path: wavPath, sizeBytes: written.sizeBytes, fromCache: false };
}

async function runVoicesLookup(deps: RenderApiDependencies) {
  try {
    return await deps.listVoiceModels();
  } catch (cause) {
    throw translateVoiceError(cause, null, 'tts-voices');
  }
}
