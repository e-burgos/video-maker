import type { CommandRunner, ReadTextFile } from '@video-maker/media-local';
import { extractAudioForTranscription, transcribeWithWhisperCpp } from '@video-maker/media-local';
import { TranscriptionSchema } from '@video-maker/timeline-core';

import type { TranscriptRef } from '../catalog/catalog.schema';
import { TranscriptionFailedError } from '../errors/transcription-failed-error';
import { assertWritableProjectPath, guardEnsureDirectory, guardWriteTextFile } from '../fs/guard-raw-writes';
import type { EnsureDirectory } from '../fs/ensure-directory';
import type { WriteTextFile } from '../fs/write-text-file';
import type { MediaProject } from '../project/media-project';
import {
  extractedAudioPath,
  rawAssetMirror,
  toAbsolutePath,
  transcriptPath,
  whisperOutBase,
  workPath,
} from '../project/project-paths';
import type { TranscriptionPlanEntry } from './plan-ingest-work';

const DEFAULT_LANGUAGE = 'auto';

export interface TranscribeAssetsOptions {
  readonly modelPath: string;
  readonly language?: string;
  readonly ffmpegPath?: string;
  readonly whisperPath?: string;
}

export interface TranscribeAssetsDependencies {
  readonly runner: CommandRunner;
  readonly readTextFile: ReadTextFile;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
}

function directoryOfMirror(mirror: string): string {
  return mirror.slice(0, mirror.lastIndexOf('/'));
}

function workSubdirectoryFor(segment: string, mirror: string): string {
  return workPath(segment, directoryOfMirror(mirror));
}

export interface TranscribeAssetsResult {
  readonly transcripts: readonly TranscriptRef[];
  readonly failures: readonly TranscriptionFailedError[];
  readonly transcribedAssetIds: readonly string[];
  readonly reusedAssetIds: readonly string[];
}

function compareByString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

async function tryReuseTranscript(
  project: MediaProject,
  plan: TranscriptionPlanEntry,
  deps: TranscribeAssetsDependencies,
): Promise<TranscriptRef | undefined> {
  if (plan.reuseCandidate === undefined) {
    return undefined;
  }

  const absoluteTranscriptPath = toAbsolutePath(project, plan.reuseCandidate.transcriptPath);

  let raw: string;
  try {
    raw = await deps.readTextFile(absoluteTranscriptPath);
  } catch {
    return undefined;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return undefined;
  }

  return TranscriptionSchema.safeParse(parsedJson).success ? plan.reuseCandidate : undefined;
}

async function transcribeFresh(
  project: MediaProject,
  plan: TranscriptionPlanEntry,
  deps: TranscribeAssetsDependencies,
  options: TranscribeAssetsOptions,
  requestedLanguage: string,
): Promise<TranscriptRef> {
  const mirror = rawAssetMirror(plan.assetId);
  const sourceAbsolutePath = toAbsolutePath(project, plan.assetId);
  const audioAbsolutePath = toAbsolutePath(project, extractedAudioPath(mirror));
  const whisperOutBaseAbsolutePath = toAbsolutePath(project, whisperOutBase(mirror));
  const transcriptAbsolutePath = toAbsolutePath(project, transcriptPath(mirror));
  const ensureDirectory = guardEnsureDirectory(project, deps.ensureDirectory);

  let extractedAudioAbsolutePath: string;
  try {
    await ensureDirectory(toAbsolutePath(project, workSubdirectoryFor('audio', mirror)));
    assertWritableProjectPath(project, audioAbsolutePath);
    extractedAudioAbsolutePath = await extractAudioForTranscription(
      sourceAbsolutePath,
      audioAbsolutePath,
      deps.runner,
      { ...(options.ffmpegPath !== undefined ? { ffmpegPath: options.ffmpegPath } : {}) },
    );
  } catch (cause) {
    throw new TranscriptionFailedError({ assetId: plan.assetId, stage: 'extract-audio', cause });
  }

  let transcription;
  try {
    await ensureDirectory(toAbsolutePath(project, workSubdirectoryFor('whisper', mirror)));
    assertWritableProjectPath(project, whisperOutBaseAbsolutePath);
    transcription = await transcribeWithWhisperCpp(
      extractedAudioAbsolutePath,
      {
        modelPath: options.modelPath,
        outBase: whisperOutBaseAbsolutePath,
        assetId: plan.assetId,
        language: requestedLanguage,
        readTextFile: deps.readTextFile,
        ...(options.whisperPath !== undefined ? { whisperPath: options.whisperPath } : {}),
      },
      deps.runner,
    );
  } catch (cause) {
    throw new TranscriptionFailedError({ assetId: plan.assetId, stage: 'transcribe', cause });
  }

  if (transcription.model === undefined) {
    throw new TranscriptionFailedError({
      assetId: plan.assetId,
      stage: 'persist',
      cause: new Error('transcribeWithWhisperCpp no devolvió un model definido.'),
    });
  }

  try {
    await ensureDirectory(toAbsolutePath(project, workSubdirectoryFor('transcripts', mirror)));
    const writeTextFile = guardWriteTextFile(project, deps.writeTextFile);
    await writeTextFile(transcriptAbsolutePath, `${JSON.stringify(transcription, null, 2)}\n`);
  } catch (cause) {
    throw new TranscriptionFailedError({ assetId: plan.assetId, stage: 'persist', cause });
  }

  return {
    assetId: plan.assetId,
    transcriptPath: transcriptPath(mirror),
    fingerprint: plan.fingerprint,
    engine: transcription.engine,
    model: transcription.model,
    language: requestedLanguage,
  };
}

export async function transcribeAssets(
  project: MediaProject,
  transcriptionPlans: readonly TranscriptionPlanEntry[],
  deps: TranscribeAssetsDependencies,
  options: TranscribeAssetsOptions,
): Promise<TranscribeAssetsResult> {
  const requestedLanguage = options.language ?? DEFAULT_LANGUAGE;
  const transcripts: TranscriptRef[] = [];
  const failures: TranscriptionFailedError[] = [];
  const transcribedAssetIds: string[] = [];
  const reusedAssetIds: string[] = [];

  for (const plan of transcriptionPlans) {
    const reused = await tryReuseTranscript(project, plan, deps);
    if (reused !== undefined) {
      transcripts.push(reused);
      reusedAssetIds.push(plan.assetId);
      continue;
    }

    try {
      const transcriptRef = await transcribeFresh(project, plan, deps, options, requestedLanguage);
      transcripts.push(transcriptRef);
      transcribedAssetIds.push(plan.assetId);
    } catch (error) {
      failures.push(
        error instanceof TranscriptionFailedError
          ? error
          : new TranscriptionFailedError({ assetId: plan.assetId, stage: 'transcribe', cause: error }),
      );
    }
  }

  transcripts.sort((a, b) => compareByString(a.assetId, b.assetId));
  failures.sort((a, b) => compareByString(a.assetId, b.assetId));

  return { transcripts, failures, transcribedAssetIds, reusedAssetIds };
}
