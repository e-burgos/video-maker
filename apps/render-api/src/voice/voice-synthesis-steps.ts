import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { dirname, join } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateVoiceError } from '../errors/translate-voice-error';
import type { VoiceStage } from '../jobs/render-job';
import {
  VOICE_TRANSCRIPTION_CHANNELS,
  VOICE_TRANSCRIPTION_SAMPLE_RATE,
} from './voice-format';
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

export interface ResolvedVoiceModel {
  readonly id: string;
  readonly path: string;
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

export async function resolveVoiceModel(
  deps: RenderApiDependencies,
  voiceId: string | null,
): Promise<ResolvedVoiceModel> {
  const binaries = await deps.resolveVoiceBinaries();
  const voices = await deps.listVoiceModels();

  if (voiceId === null) {
    const configured = voices.find((voice) => voice.isDefault);
    return {
      id: configured?.id ?? dirname(binaries.piperModel),
      path: binaries.piperModel,
    };
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

  return { id: requested.id, path: join(dirname(binaries.piperModel), requested.fileName) };
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

export async function transcribeVoiceTrackInto(
  trackId: string,
  trackPath: string,
  wordsPath: string,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<string> {
  const whisperWavPath = voiceWhisperWavPath(trackId);

  await deps.extractVoiceAudio({
    inputPath: toAbsolutePath(project, trackPath),
    outPath: toAbsolutePath(project, whisperWavPath),
    sampleRate: VOICE_TRANSCRIPTION_SAMPLE_RATE,
    channels: VOICE_TRANSCRIPTION_CHANNELS,
    projectRoot: project.root,
  });

  const transcription = await deps.transcribeVoice({
    wavPath: toAbsolutePath(project, whisperWavPath),
    outBase: toAbsolutePath(project, voiceWhisperOutBase(trackId)),
    assetId: trackPath,
    language: whisperLanguageFor(language),
    projectRoot: project.root,
  });

  return writeVoiceWords(deps, project, wordsPath, transcription);
}
