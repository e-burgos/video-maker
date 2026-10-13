import type { ReviewStatus } from '@video-maker/timeline-core';
import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import { createProjectBrandResolver } from '../../brands/project-brand-resolver';
import { sampleFileClassifierFor } from '../../jobs/sample-files';
import type { JobsBySlug, SampleFileClassifier } from '../../jobs/sample-files';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { parsePublishFile } from '../../jobs/publish-job-params';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { readReview } from '../../review/review-store';
import { readCreditsText } from '../../youtube/publish-credits';
import { assertPublishableVideo } from '../../youtube/publish-preconditions';
import { draftYoutubeMetadata, isShortVideo } from '../../youtube/draft-youtube-metadata';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

interface PublishFileOption {
  readonly path: string;
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
  readonly isShort: boolean;
  readonly sizeBytes: number;
  readonly reviewStatus: ReviewStatus | null;
}

interface PublishPlaylistOption {
  readonly id: string;
  readonly title: string;
}

export interface YoutubePublishOptionsBody {
  readonly files: readonly PublishFileOption[];
  readonly playlists: readonly PublishPlaylistOption[];
  readonly defaults: { readonly privacy: 'public' };
}

export interface PublicationBody {
  readonly id: string;
  readonly platform: string;
  readonly file: string;
  readonly title: string;
  readonly videoId: string | null;
  readonly url: string | null;
  readonly privacy: string;
  readonly status: string;
  readonly publishAt: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
}

const OUT_DIRECTORY = 'out';
const SWAPPED_ROTATIONS: readonly number[] = [90, 270];

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

interface ProbedVideo {
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
}

async function probeVideo(deps: RenderApiDependencies, file: string, absolutePath: string): Promise<ProbedVideo | null> {
  try {
    const asset = await deps.probeAsset({ path: absolutePath, assetId: file });
    if (asset.kind !== 'video' || asset.width === undefined || asset.height === undefined) {
      return null;
    }
    const swapped = asset.rotation !== undefined && SWAPPED_ROTATIONS.includes(asset.rotation);
    return {
      durationSec: asset.durationMs / 1000,
      width: swapped ? asset.height : asset.width,
      height: swapped ? asset.width : asset.height,
    };
  } catch {
    return null;
  }
}

async function listPublishFiles(
  deps: RenderApiDependencies,
  project: MediaProject,
  isSample: SampleFileClassifier,
): Promise<PublishFileOption[]> {
  const entries = (await deps.storage.listDirectory(project.outDir)) ?? [];
  const candidates = entries.filter((entry) => entry.isFile && !entry.name.startsWith('.') && entry.name.endsWith('.mp4') && !isSample(`${OUT_DIRECTORY}/${entry.name}`));
  const files: (PublishFileOption & { readonly modifiedAtMs: number })[] = [];

  for (const entry of candidates) {
    const path = `${OUT_DIRECTORY}/${entry.name}`;
    const absolutePath = join(project.outDir, entry.name);
    const stat = await deps.storage.stat(absolutePath);
    const probed = await probeVideo(deps, path, absolutePath);
    if (stat === null || probed === null) {
      continue;
    }
    files.push({
      path,
      durationSec: probed.durationSec,
      width: probed.width,
      height: probed.height,
      isShort: isShortVideo(probed.width, probed.height, probed.durationSec),
      sizeBytes: stat.sizeBytes,
      reviewStatus: (await readReview(deps.storage, project, path))?.report.status ?? null,
      modifiedAtMs: stat.modifiedAtMs,
    });
  }

  return files
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs || left.path.localeCompare(right.path))
    .map((file) => ({
      path: file.path,
      durationSec: file.durationSec,
      width: file.width,
      height: file.height,
      isShort: file.isShort,
      sizeBytes: file.sizeBytes,
      reviewStatus: file.reviewStatus,
    }));
}

async function listPlaylistsIfConnected(runtime: RenderApiRuntime): Promise<PublishPlaylistOption[]> {
  try {
    const status = await runtime.youtube.oauth.status();
    if (!status.connected || !status.clientConfigured) {
      return [];
    }
    return (await runtime.youtube.client.listPlaylists()).map(({ id, title }) => ({ id, title }));
  } catch {
    return [];
  }
}

export async function handleGetYoutubePublishOptions(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const body: YoutubePublishOptionsBody = {
    files: await listPublishFiles(deps, project, sampleFileClassifierFor(runtime.jobs, slug)),
    playlists: await listPlaylistsIfConnected(runtime),
    defaults: { privacy: 'public' },
  };
  return jsonResponse(200, body);
}

export async function handleDraftYoutubeMetadata(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  jobs?: JobsBySlug,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const file = parsePublishFile((await readJsonObjectBody(request)).file);
  await assertPublishableVideo(deps.storage, project, file, sampleFileClassifierFor(jobs, slug));

  const probed = await probeVideo(deps, file, toAbsolutePath(project, file));
  if (probed === null) {
    throw new PipelineStageError({
      code: 'PUBLISH_FILE_INVALID',
      stage: null,
      resource: file,
      expected: 'a video file ffprobe can read',
    });
  }

  const draft = await draftYoutubeMetadata(deps, {
    project,
    mode: deps.localStore.projects.get(slug)?.mode ?? 'footage',
    brand: await createProjectBrandResolver(deps, store)(slug),
    durationSec: probed.durationSec,
    width: probed.width,
    height: probed.height,
    credits: await readCreditsText(deps.storage, project, file),
  });
  return jsonResponse(200, { title: draft.title, description: draft.description, tags: draft.tags });
}

export async function handleListPublications(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  await resolveExistingProject(deps, store, slug);

  const body: PublicationBody[] = deps.localStore.publications.listByProject(slug).map((record) => ({
    id: record.id,
    platform: record.platform,
    file: record.file,
    title: record.title,
    videoId: record.videoId,
    url: record.url,
    privacy: record.privacy,
    status: record.status,
    publishAt: record.publishAt,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
  }));
  return jsonResponse(200, body);
}
