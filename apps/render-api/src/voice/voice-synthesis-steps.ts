import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import type { Transcription } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateVoiceError } from '../errors/translate-voice-error';
import type { VoiceStage } from '../jobs/render-job';
import {
  VOICE_TRANSCRIPTION_CHANNELS,
  VOICE_TRANSCRIPTION_SAMPLE_RATE,
} from './voice-format';
import { defaultElevenLabsVoiceId, isElevenLabsKeyConfigured, isElevenLabsVoiceId } from './elevenlabs-voice';
import { whisperLanguageFor } from './voice-language';
import {
  voiceDirectoryPath,
  voiceSourcesDirectoryPath,
  voiceWhisperDirectoryPath,
  voiceWhisperOutBase,
  voiceWhisperWavPath,
  voiceWordsPath,
} from './voice-paths';
import { writeVoiceWords } from './voice-store';

export interface BrandVoice {
  readonly id: string;
  readonly lengthScale: number;
}

export interface ResolvedVoiceModel {
  readonly id: string;
  readonly path: string;
  readonly lengthScale?: number;
}

export function synthesisLengthScale(model: ResolvedVoiceModel, relativeScale: number): number {
  return Math.round(relativeScale * (model.lengthScale ?? 1) * 1000) / 1000;
}

export async function runVoiceStage<T>(
  stage: VoiceStage,
  resource: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw translateVoiceError(cause, stage, resource);
  }
}

export const ELEVENLABS_VOICE_MODEL_PATH = '';

export function elevenLabsVoiceModel(voiceId: string, lengthScale?: number): ResolvedVoiceModel {
  return { id: voiceId, path: ELEVENLABS_VOICE_MODEL_PATH, ...(lengthScale === undefined ? {} : { lengthScale }) };
}

export function engineVoiceFields(
  model: ResolvedVoiceModel,
  language: string,
): { voiceId?: string; languageCode?: string } {
  return isElevenLabsVoiceId(model.id) ? { voiceId: model.id, languageCode: whisperLanguageFor(language) } : {};
}

export async function resolveVoiceModel(
  deps: RenderApiDependencies,
  voiceId: string | null,
  brandVoice: BrandVoice | null = null,
): Promise<ResolvedVoiceModel> {
  if (voiceId !== null && isElevenLabsVoiceId(voiceId)) {
    return elevenLabsVoiceModel(voiceId);
  }
  if (voiceId === null && brandVoice !== null && isElevenLabsVoiceId(brandVoice.id) && (await isElevenLabsKeyConfigured(deps))) {
    return elevenLabsVoiceModel(brandVoice.id, brandVoice.lengthScale);
  }

  const binaries = await deps.resolveVoiceBinaries();
  const voices = await deps.listVoiceModels();

  if (voiceId === null && brandVoice !== null) {
    const installed = voices.find((voice) => voice.id === brandVoice.id);
    if (installed !== undefined) {
      return {
        id: installed.id,
        path: join(binaries.ttsVoicesDir, installed.directory),
        lengthScale: brandVoice.lengthScale,
      };
    }
  }

  const elevenLabsDefault = voiceId === null ? await defaultElevenLabsVoiceId(deps) : null;
  if (elevenLabsDefault !== null) {
    return elevenLabsVoiceModel(elevenLabsDefault);
  }

  if (voiceId === null) {
    const configured = voices.find((voice) => voice.isDefault) ?? voices[0];
    if (configured === undefined) {
      throw new PipelineStageError({
        code: 'VOICE_MODEL_UNAVAILABLE',
        stage: null,
        resource: null,
        expected: 'at least one voice installed under TTS_VOICES_DIR',
      });
    }
    return { id: configured.id, path: join(binaries.ttsVoicesDir, configured.directory) };
  }

  const requested = voices.find((voice) => voice.id === voiceId);
  if (requested === undefined) {
    throw new PipelineStageError({
      code: 'VOICE_ID_INVALID',
      stage: null,
      resource: voiceId,
      expected: 'a voice model id listed by GET /voices',
    });
  }

  return { id: requested.id, path: join(binaries.ttsVoicesDir, requested.directory) };
}

export async function ensureVoiceDirectories(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<void> {
  for (const directory of [voiceDirectoryPath(), voiceSourcesDirectoryPath(), voiceWhisperDirectoryPath()]) {
    await deps.storage.ensureDirectory(toAbsolutePath(project, directory));
  }
}

export async function transcribeVoiceTrack(
  sceneId: string,
  trackPath: string,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<string> {
  return transcribeVoiceTrackInto(sceneId, trackPath, voiceWordsPath(sceneId), language, deps, project);
}

export async function transcribeVoiceTrackDocument(
  trackId: string,
  trackPath: string,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<Transcription> {
  const whisperWavPath = voiceWhisperWavPath(trackId);

  await deps.extractVoiceAudio({
    inputPath: toAbsolutePath(project, trackPath),
    outPath: toAbsolutePath(project, whisperWavPath),
    sampleRate: VOICE_TRANSCRIPTION_SAMPLE_RATE,
    channels: VOICE_TRANSCRIPTION_CHANNELS,
    projectRoot: project.root,
  });

  return deps.transcribeVoice({
    wavPath: toAbsolutePath(project, whisperWavPath),
    outBase: toAbsolutePath(project, voiceWhisperOutBase(trackId)),
    assetId: trackPath,
    language: whisperLanguageFor(language),
    projectRoot: project.root,
  });
}

export async function transcribeVoiceTrackInto(
  trackId: string,
  trackPath: string,
  wordsPath: string,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<string> {
  const transcription = await transcribeVoiceTrackDocument(
    trackId,
    trackPath,
    language,
    deps,
    project,
  );

  return writeVoiceWords(deps, project, wordsPath, transcription);
}
