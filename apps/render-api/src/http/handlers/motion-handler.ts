import { applyBriefBoxes, briefImageRef, checkStoryboardBoxes, isMotionStudioError, parseBrandManifest, parseMotionBrief, parseMotionStoryboard } from '@video-maker/motion-graphics';
import type { MotionBrief, MotionStoryboard } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { MotionBrandDocument, MotionBrandSource, RenderApiDependencies } from '../../deps/render-api-dependencies';
import { sampleFileClassifierFor } from '../../jobs/sample-files';
import type { JobsBySlug } from '../../jobs/sample-files';
import { readMotionOverview } from '../../motion/read-motion-overview';
import {
  availableImageRefs,
  describeImageProblem,
  findStoryboardImageProblem,
  listRawImages,
  parseBrandIfValid,
} from '../../motion/validate-storyboard-images';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import type { RenderApiErrorCode } from '../../errors/render-api-error';
import { assertMotionProject, assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

const BRIEF_RELATIVE_PATH = 'motion/brief.json';
const STORYBOARD_RELATIVE_PATH = 'motion/storyboard.json';
const SUPPORTED_FORMATS = ['16:9', '9:16'] as const;

export interface MotionBrandMusicSummary {
  readonly id: string;
  readonly mood: string;
  readonly bpm: number;
  readonly hasDrop: boolean;
}

export interface MotionBrandSummary {
  readonly id: string;
  readonly name: string;
  readonly source: MotionBrandSource;
  readonly formats: readonly string[];
  readonly music: readonly MotionBrandMusicSummary[];
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function toBrandSummary(document: MotionBrandDocument): MotionBrandSummary {
  let manifest;
  try {
    manifest = parseBrandManifest(document.manifest);
  } catch (cause) {
    throw new PipelineStageError({
      code: 'SERVER_CONFIG_INVALID',
      stage: null,
      resource: `brands/${document.id}/brand.json`,
      expected: 'a valid brand manifest',
      cause,
    });
  }

  return {
    id: manifest.id,
    name: manifest.name,
    source: document.source,
    formats: SUPPORTED_FORMATS,
    music: manifest.music.map((track) => ({
      id: track.id,
      mood: track.mood,
      bpm: track.bpm,
      hasDrop: track.drop !== undefined,
    })),
  };
}

export async function handleListMotionBrands(deps: RenderApiDependencies): Promise<HttpResponse> {
  const summaries = (await deps.listMotionBrands()).map(toBrandSummary);
  summaries.sort((left, right) => left.id.localeCompare(right.id));
  return jsonResponse(200, summaries);
}

async function resolveMotionProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<{ readonly root: string; readonly rawDir: string }> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  assertMotionProject(deps, slug);
  return project;
}

async function readStoredDocument(
  deps: RenderApiDependencies,
  absolutePath: string,
  relativePath: string,
  missingCode: RenderApiErrorCode,
  invalidCode: RenderApiErrorCode,
): Promise<unknown> {
  const stat = await deps.storage.stat(absolutePath);
  if (stat === null || stat.kind !== 'file') {
    throw new PipelineStageError({ code: missingCode, stage: null, resource: relativePath });
  }

  try {
    return JSON.parse(await deps.storage.readTextFile(absolutePath));
  } catch {
    throw new PipelineStageError({
      code: invalidCode,
      stage: null,
      resource: relativePath,
      expected: 'a JSON document',
    });
  }
}

async function readRequestJson(request: HttpRequestLine): Promise<unknown> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind !== 'parsed') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }
  return bodyResult.value;
}

function parseOrThrow<T>(
  parse: (raw: unknown) => T,
  raw: unknown,
  code: RenderApiErrorCode,
  resource: string,
): T {
  try {
    return parse(raw);
  } catch (cause) {
    if (isMotionStudioError(cause)) {
      throw new PipelineStageError({ code, stage: null, resource, expected: cause.message, cause });
    }
    throw cause;
  }
}

async function assertBrandInstalled(deps: RenderApiDependencies, brief: MotionBrief): Promise<void> {
  const brands = await deps.listMotionBrands();
  if (!brands.some((brand) => brand.id === brief.brand)) {
    throw new PipelineStageError({
      code: 'BRAND_NOT_FOUND',
      stage: null,
      resource: brief.brand,
      expected: brands.map((brand) => brand.id).join(', '),
    });
  }
}

async function assertBriefImagesExist(
  deps: RenderApiDependencies,
  rawDir: string,
  brief: MotionBrief,
): Promise<void> {
  const imagesDir = join(rawDir, 'images');
  for (const image of brief.images) {
    const name = briefImageRef(image.file).slice('images/'.length);
    const stat = name.includes('/') || name.includes('..') ? null : await deps.storage.stat(join(imagesDir, name));
    if (stat === null || stat.kind !== 'file') {
      throw new PipelineStageError({
        code: 'BRIEF_INVALID',
        stage: null,
        resource: BRIEF_RELATIVE_PATH,
        expected: `images[].file "${image.file}" must exist under raw/images/`,
      });
    }
  }
}

export async function handleGetMotionBrief(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const project = await resolveMotionProject(deps, store, params);
  const document = await readStoredDocument(
    deps,
    join(project.root, BRIEF_RELATIVE_PATH),
    BRIEF_RELATIVE_PATH,
    'BRIEF_NOT_FOUND',
    'BRIEF_INVALID',
  );
  return jsonResponse(200, document);
}

export async function handlePutMotionBrief(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const project = await resolveMotionProject(deps, store, params);
  const brief = parseOrThrow(parseMotionBrief, await readRequestJson(request), 'BRIEF_INVALID', BRIEF_RELATIVE_PATH);
  await assertBrandInstalled(deps, brief);
  await assertBriefImagesExist(deps, project.rawDir, brief);

  await deps.storage.ensureDirectory(join(project.root, 'motion'));
  await deps.storage.writeTextFile(join(project.root, BRIEF_RELATIVE_PATH), `${JSON.stringify(brief, null, 2)}\n`);
  deps.localStore.projects.setBrand(params.slug ?? '', brief.brand);
  return jsonResponse(200, brief);
}

export async function handleGetMotionStoryboard(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const project = await resolveMotionProject(deps, store, params);
  const document = await readStoredDocument(
    deps,
    join(project.root, STORYBOARD_RELATIVE_PATH),
    STORYBOARD_RELATIVE_PATH,
    'STORYBOARD_NOT_FOUND',
    'STORYBOARD_INVALID',
  );
  return jsonResponse(200, document);
}

async function assertStoryboardImagesResolve(
  deps: RenderApiDependencies,
  rawDir: string,
  storyboard: MotionStoryboard,
): Promise<void> {
  const brandDocument = (await deps.listMotionBrands()).find((document) => document.id === storyboard.brand);
  const brand = brandDocument === undefined ? null : parseBrandIfValid(brandDocument.manifest);
  const available = availableImageRefs(await listRawImages(deps.storage, rawDir), brand);
  const problem = findStoryboardImageProblem(storyboard, available, brand);
  if (problem !== null) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INVALID',
      stage: null,
      resource: STORYBOARD_RELATIVE_PATH,
      expected: describeImageProblem(problem, available),
    });
  }
}

async function readStoredBrief(deps: RenderApiDependencies, projectRoot: string): Promise<MotionBrief | null> {
  const path = join(projectRoot, BRIEF_RELATIVE_PATH);
  const stat = await deps.storage.stat(path);
  if (stat === null || stat.kind !== 'file') {
    return null;
  }
  try {
    return parseMotionBrief(JSON.parse(await deps.storage.readTextFile(path)));
  } catch {
    return null;
  }
}

function resolveStoryboardBoxes(storyboard: MotionStoryboard, brief: MotionBrief | null): MotionStoryboard {
  const resolved = brief === null ? storyboard : applyBriefBoxes(storyboard, brief);
  const issues = checkStoryboardBoxes(resolved, brief);
  if (issues.length > 0) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INVALID',
      stage: null,
      resource: STORYBOARD_RELATIVE_PATH,
      expected: issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'),
    });
  }
  return resolved;
}

export async function handleGetMotionOverview(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  jobs?: JobsBySlug,
): Promise<HttpResponse> {
  const project = await resolveMotionProject(deps, store, params);
  return jsonResponse(200, await readMotionOverview(deps.storage, project.root, sampleFileClassifierFor(jobs, params.slug ?? '')));
}

export async function handlePutMotionStoryboard(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const project = await resolveMotionProject(deps, store, params);
  const parsed = parseOrThrow(
    parseMotionStoryboard,
    await readRequestJson(request),
    'STORYBOARD_INVALID',
    STORYBOARD_RELATIVE_PATH,
  );
  await assertStoryboardImagesResolve(deps, project.rawDir, parsed);
  const storyboard = resolveStoryboardBoxes(parsed, await readStoredBrief(deps, project.root));

  await deps.storage.ensureDirectory(join(project.root, 'motion'));
  await deps.storage.writeTextFile(
    join(project.root, STORYBOARD_RELATIVE_PATH),
    `${JSON.stringify(storyboard, null, 2)}\n`,
  );
  return jsonResponse(200, storyboard);
}
