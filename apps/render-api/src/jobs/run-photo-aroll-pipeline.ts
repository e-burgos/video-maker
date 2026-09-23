import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import type { VoiceScriptManifest } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateEngineError } from '../errors/translate-engine-error';
import { resolveProducerPath } from '../store/producer-writable-paths';
import { voiceScriptTrackPath } from '../voice/voice-paths';
import { readStoredVoiceScriptManifest } from '../voice/voice-store';
import { checkpoint } from './photo-aroll-pipeline-observer';
import type { PhotoArollPipelineObserver } from './photo-aroll-pipeline-observer';
import type { PhotoArollJobReport } from './render-job';

export interface PhotoArollPipelineRequest {
  readonly project: MediaProject;
  readonly photos: readonly string[];
  readonly output: string;
  readonly fps: number;
}

const AD_DIRECTORY = workPath('producer', 'ad');
const IMAGES_ROOT_PREFIX = 'raw/images/';
const AROLL_DIRECTORY = 'raw/aroll';

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function clipFileName(index: number): string {
  return `${String(index + 1).padStart(2, '0')}.mp4`;
}

async function resolvePhotoAbsolutePaths(
  deps: RenderApiDependencies,
  project: MediaProject,
  photos: readonly string[],
): Promise<readonly string[]> {
  const resolved: string[] = [];

  for (const photo of photos) {
    const resolvedPath = await resolveProducerPath(deps.storage, project, photo);
    if (!resolvedPath.relativePath.startsWith(IMAGES_ROOT_PREFIX)) {
      throw invalidInput(resolvedPath.relativePath, `a path under ${IMAGES_ROOT_PREFIX}`);
    }

    const fileStat = await deps.storage.stat(resolvedPath.absolutePath);
    if (fileStat === null || fileStat.kind !== 'file') {
      throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: resolvedPath.relativePath });
    }

    resolved.push(resolvedPath.absolutePath);
  }

  return resolved;
}

interface ClipPlan {
  readonly photoPath: string;
  readonly frames: number;
  readonly outPath: string;
}

function planClips(
  manifest: VoiceScriptManifest,
  photoAbsolutePaths: readonly string[],
  fps: number,
  project: MediaProject,
): readonly ClipPlan[] {
  return manifest.lines.map((line, index) => {
    const nextLine = manifest.lines[index + 1];
    const endMs = nextLine === undefined ? manifest.durationMs : nextLine.startMs;
    const seconds = Math.max(0, endMs - line.startMs) / 1000;
    const frames = Math.max(1, Math.round(seconds * fps));
    const photoPath = photoAbsolutePaths[index % photoAbsolutePaths.length] as string;

    return {
      photoPath,
      frames,
      outPath: toAbsolutePath(project, `${AD_DIRECTORY}/${clipFileName(index)}`),
    };
  });
}

export async function runPhotoArollPipeline(
  request: PhotoArollPipelineRequest,
  deps: RenderApiDependencies,
  observer: PhotoArollPipelineObserver,
): Promise<PhotoArollJobReport> {
  const manifest = await readStoredVoiceScriptManifest(deps, request.project);
  const photoAbsolutePaths = await resolvePhotoAbsolutePaths(deps, request.project, request.photos);
  const clips = planClips(manifest, photoAbsolutePaths, request.fps, request.project);

  checkpoint(observer, 'clips');
  observer.stageStarted('clips');

  const adDirectory = toAbsolutePath(request.project, AD_DIRECTORY);
  await deps.storage.ensureDirectory(adDirectory);

  for (const clip of clips) {
    checkpoint(observer, 'clips');

    try {
      await deps.buildKenBurnsClip({
        photoPath: clip.photoPath,
        frames: clip.frames,
        fps: request.fps,
        outPath: clip.outPath,
        projectRoot: request.project.root,
      });
    } catch (cause) {
      throw translateEngineError(cause, null, clip.outPath);
    }

    observer.clipProcessed(clips.length);
  }

  checkpoint(observer, 'concat');
  observer.stageStarted('concat');

  const listPath = toAbsolutePath(request.project, `${AD_DIRECTORY}/list.txt`);
  const listContents = `${clips.map((clip) => `file '${clip.outPath}'`).join('\n')}\n`;
  await deps.storage.writeTextFile(listPath, listContents);

  const silentPath = toAbsolutePath(request.project, `${AD_DIRECTORY}/silent.mp4`);
  try {
    await deps.concatVideoClips({ listPath, outPath: silentPath, projectRoot: request.project.root });
  } catch (cause) {
    throw translateEngineError(cause, null, silentPath);
  }

  checkpoint(observer, 'mux');
  observer.stageStarted('mux');

  const voicePath = toAbsolutePath(request.project, voiceScriptTrackPath());
  const outputRelativePath = `${AROLL_DIRECTORY}/${request.output}`;
  const outputAbsolutePath = toAbsolutePath(request.project, outputRelativePath);

  await deps.storage.ensureDirectory(toAbsolutePath(request.project, AROLL_DIRECTORY));

  try {
    await deps.muxAudioIntoVideo({ videoPath: silentPath, audioPath: voicePath, outPath: outputAbsolutePath });
  } catch (cause) {
    throw translateEngineError(cause, null, outputAbsolutePath);
  }

  return {
    path: outputRelativePath,
    clips: clips.length,
    frames: clips.reduce((sum, clip) => sum + clip.frames, 0),
    durationMs: manifest.durationMs,
  };
}
