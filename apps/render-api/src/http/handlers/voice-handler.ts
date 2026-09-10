import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { emptyVoiceManifest, hashNarration, isVoiceTrackStale, upsertVoiceTrack } from '@video-maker/timeline-core';
import type { StoryboardDocument, VoiceManifest, VoiceTrack } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { translateVoiceError } from '../../errors/translate-voice-error';
import { ensureVoiceDirectories, transcribeVoiceTrack } from '../../jobs/run-voice-pipeline';
import { readStoryboardIfUsable } from '../../storyboard/storyboard-store';
import { isPortableFileName, rawDirectoryForRole } from '../../store/asset-path';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { VOICE_TRACK_CHANNELS, VOICE_TRACK_SAMPLE_RATE } from '../../voice/voice-format';
import { voiceTrackPath } from '../../voice/voice-paths';
import { readStoredVoiceManifest, readVoiceManifestIfUsable, writeVoiceManifest } from '../../voice/voice-store';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

export interface VoiceSceneStatus {
  readonly sceneId: string;
  readonly index: number;
  readonly source: VoiceTrack['source'];
  readonly stale: boolean | null;
}

export interface VoiceBody {
  readonly slug: string;
  readonly manifest: VoiceManifest;
  readonly scenes: readonly VoiceSceneStatus[];
}

export interface VoiceSceneBody {
  readonly slug: string;
  readonly path: string;
  readonly track: VoiceTrack;
}

function toSceneStatuses(
  manifest: VoiceManifest,
  document: StoryboardDocument | null,
): readonly VoiceSceneStatus[] {
  return manifest.tracks.map((track) => {
    const scene = document?.scenes.find((candidate) => candidate.id === track.sceneId);
    return {
      sceneId: track.sceneId,
      index: track.index,
      source: track.source,
      stale: scene === undefined ? null : isVoiceTrackStale(track, scene.narration),
    };
  });
}

export async function handleGetVoice(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const manifest = await readStoredVoiceManifest(deps, project);
  const document = await readStoryboardIfUsable(deps, project);
  const body: VoiceBody = { slug, manifest, scenes: toSceneStatuses(manifest, document) };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function readFileName(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object with a fileName',
    });
  }

  const fileName = (value as { fileName?: unknown }).fileName;
  if (typeof fileName !== 'string' || !isPortableFileName(fileName)) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: 'fileName',
      expected: 'a portable file name already uploaded under raw/voice',
    });
  }

  return fileName;
}

async function resolveUploadedVoicePath(
  deps: RenderApiDependencies,
  project: MediaProject,
  fileName: string,
): Promise<string> {
  const relativePath = join('raw', rawDirectoryForRole('voice'), fileName);
  const stat = await deps.storage.stat(toAbsolutePath(project, relativePath));

  if (stat === null || stat.kind !== 'file') {
    throw new PipelineStageError({ code: 'VOICE_ASSET_NOT_FOUND', stage: null, resource: relativePath });
  }

  return relativePath;
}

export async function handlePutVoiceScene(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  const sceneId = params.sceneId ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json' || bodyResult.kind === 'empty') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object with a fileName',
    });
  }

  const fileName = readFileName(bodyResult.value);
  const project = await resolveExistingProject(deps, store, slug);
  const document = await readStoryboardIfUsable(deps, project);

  if (document === null) {
    throw new PipelineStageError({ code: 'STORYBOARD_NOT_FOUND', stage: null, resource: sceneId });
  }

  const scene = document.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined) {
    throw new PipelineStageError({ code: 'VOICE_SCENE_NOT_FOUND', stage: null, resource: sceneId });
  }

  const uploadedPath = await resolveUploadedVoicePath(deps, project, fileName);
  const trackPath = voiceTrackPath(scene.id);

  const track = await (async (): Promise<VoiceTrack> => {
    try {
      await ensureVoiceDirectories(deps, project);
      await deps.extractVoiceAudio({
        inputPath: toAbsolutePath(project, uploadedPath),
        outPath: toAbsolutePath(project, trackPath),
        sampleRate: VOICE_TRACK_SAMPLE_RATE,
        channels: VOICE_TRACK_CHANNELS,
        projectRoot: project.root,
      });

      const probed = await deps.probeAsset({
        path: toAbsolutePath(project, trackPath),
        assetId: trackPath,
      });

      const wordsPath = await transcribeVoiceTrack(
        scene.id,
        trackPath,
        document.language,
        deps,
        project,
      );

      return {
        sceneId: scene.id,
        index: scene.index,
        source: 'uploaded',
        path: trackPath,
        wordsPath,
        durationMs: probed.durationMs,
        sampleRate: probed.audio?.sampleRate ?? VOICE_TRACK_SAMPLE_RATE,
        voiceId: null,
        narrationHash: hashNarration(scene.narration),
        updatedAt: deps.clock.nowIso(),
      };
    } catch (cause) {
      throw translateVoiceError(cause, 'transcribe', scene.id);
    }
  })();

  const stored = await readVoiceManifestIfUsable(deps, project);
  const base: VoiceManifest = stored ?? emptyVoiceManifest(document.id, document.language);
  const writtenPath = await writeVoiceManifest(deps, project, upsertVoiceTrack(base, track));
  const body: VoiceSceneBody = { slug, path: writtenPath, track };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
