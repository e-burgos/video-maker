import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { brandImageFile } from '@video-maker/motion-graphics';
import { MAX_VIEW_IMAGES_PATHS, MIN_VIEW_IMAGES_PATHS } from '@video-maker/producer-tools';
import { join } from 'node:path/posix';

import { locateBrand, isSafeRelativePath, readManifest } from '../../brands/brand-library';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { translateEngineError } from '../../errors/translate-engine-error';
import { recordViewedImages } from '../../material/material-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { resolveProducerPath } from '../../store/producer-writable-paths';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

const PREVIEWS_DIRECTORY = 'work/frames/previews';
const PREVIEW_MAX_LONG_SIDE_PX = 1280;
const BRAND_PREFIX = 'brand:';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

interface PreviewImagesRequestBody {
  readonly paths: readonly string[];
}

function parsePreviewImagesBody(value: unknown): PreviewImagesRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const paths = bodyObject.paths;

  const isValidPaths =
    Array.isArray(paths) &&
    paths.length >= MIN_VIEW_IMAGES_PATHS &&
    paths.length <= MAX_VIEW_IMAGES_PATHS &&
    paths.every((entry) => typeof entry === 'string' && entry.trim().length > 0);

  if (!isValidPaths) {
    throw invalidInput('paths', `an array of ${MIN_VIEW_IMAGES_PATHS} to ${MAX_VIEW_IMAGES_PATHS} non-empty project-relative paths`);
  }

  return { paths: paths as readonly string[] };
}

function previewFileName(hashText: (text: string) => string, sourcePath: string): string {
  return `${hashText(sourcePath)}.jpg`;
}

interface PreviewSource {
  readonly reference: string;
  readonly absolutePath: string;
}

async function resolveBrandPreviewSource(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
  reference: string,
): Promise<PreviewSource> {
  const brandId = deps.localStore.projects.get(slug)?.brand ?? null;
  if (brandId === null) {
    throw invalidInput(reference, 'a project with a brand: this project has none, so only project images can be viewed');
  }
  const located = await locateBrand(deps, store, brandId);
  const manifest = await readManifest(deps, located);
  const key = reference.slice(BRAND_PREFIX.length);
  const file = brandImageFile(manifest, key);
  if (file === undefined || !isSafeRelativePath(file)) {
    throw invalidInput(reference, `brand:<key> with one of ${Object.keys(manifest.images).sort().join(', ') || 'no keys'}`);
  }
  return { reference, absolutePath: join(located.dir, file) };
}

async function resolvePreviewSource(
  deps: RenderApiDependencies,
  store: StoreConfig,
  project: MediaProject,
  slug: string,
  path: string,
): Promise<PreviewSource> {
  if (path.startsWith(BRAND_PREFIX)) {
    return resolveBrandPreviewSource(deps, store, slug, path);
  }
  const resolved = await resolveProducerPath(deps.storage, project, path);
  return { reference: resolved.relativePath, absolutePath: resolved.absolutePath };
}

export async function handlePreviewImages(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { paths } = parsePreviewImagesBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);
  await deps.storage.ensureDirectory(toAbsolutePath(project, PREVIEWS_DIRECTORY));

  const previews: { readonly path: string; readonly previewPath: string }[] = [];
  for (const path of paths) {
    const source = await resolvePreviewSource(deps, store, project, slug, path);

    const fileStat = await deps.storage.stat(source.absolutePath);
    if (fileStat === null || fileStat.kind !== 'file') {
      throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: source.reference });
    }

    const relativePreviewPath = `${PREVIEWS_DIRECTORY}/${previewFileName(deps.hashText, source.reference)}`;
    const absolutePreviewPath = toAbsolutePath(project, relativePreviewPath);

    await deps
      .resizeImage({
        path: source.absolutePath,
        outPath: absolutePreviewPath,
        maxLongSidePx: PREVIEW_MAX_LONG_SIDE_PX,
        projectRoot: project.root,
      })
      .catch((cause: unknown) => {
        throw translateEngineError(cause, null, source.reference);
      });

    previews.push({ path: source.reference, previewPath: relativePreviewPath });
  }

  await recordViewedImages(deps, project, previews.map((preview) => preview.path), deps.clock.nowIso());

  return jsonResponse(200, { previews });
}
