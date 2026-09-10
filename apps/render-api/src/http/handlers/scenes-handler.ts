import type { NumberedSceneSkip } from '@video-maker/auto-montage';
import type { SceneAssignment, StoryboardDocument } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import {
  collectRawAssetIds,
  mergeNumberedMapping,
  numberedMappingFor,
  parseImportReplace,
  parseImportRoles,
} from '../../scenes/scene-import';
import {
  assertAssignmentMatchesStoryboard,
  parseSceneAssignment,
  readSceneAssignmentOrEmpty,
  writeSceneAssignment,
} from '../../scenes/scenes-store';
import { readStoredStoryboard } from '../../storyboard/storyboard-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

export interface SceneSlot {
  readonly sceneId: string;
  readonly index: number;
  readonly visualSource: StoryboardDocument['scenes'][number]['visualSource'];
  readonly visualPrompt: string;
  readonly assetId: string | null;
}

export interface ScenesBody {
  readonly slug: string;
  readonly path: string;
  readonly storyboardId: string;
  readonly assignment: SceneAssignment;
  readonly slots: readonly SceneSlot[];
}

export interface SceneImportBody extends ScenesBody {
  readonly imported: number;
  readonly skipped: readonly NumberedSceneSkip[];
}

function toSlots(storyboard: StoryboardDocument, assignment: SceneAssignment): readonly SceneSlot[] {
  const assetBySceneId = new Map(assignment.assignments.map((entry) => [entry.sceneId, entry.assetId] as const));

  return storyboard.scenes.map((scene) => ({
    sceneId: scene.id,
    index: scene.index,
    visualSource: scene.visualSource,
    visualPrompt: scene.visualPrompt,
    assetId: scene.visualSource === 'asset' ? (scene.assetId ?? null) : (assetBySceneId.get(scene.id) ?? null),
  }));
}

function scenesBody(
  slug: string,
  path: string,
  storyboard: StoryboardDocument,
  assignment: SceneAssignment,
): ScenesBody {
  return {
    slug,
    path,
    storyboardId: storyboard.id,
    assignment,
    slots: toSlots(storyboard, assignment),
  };
}

async function readRequestObject(request: HttpRequestLine): Promise<Record<string, unknown>> {
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
      expected: 'a JSON object',
    });
  }

  const { value } = bodyResult;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  return value as Record<string, unknown>;
}

export async function handleGetScenes(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const storyboard = await readStoredStoryboard(deps, project);
  const assignment = await readSceneAssignmentOrEmpty(deps, project, storyboard);

  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE },
    body: scenesBody(slug, 'work/scenes.json', storyboard, assignment),
  };
}

export async function handlePutScenes(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const body = await readRequestObject(request);
  const storyboard = await readStoredStoryboard(deps, project);
  const assignment = parseSceneAssignment(body, 'work/scenes.json');
  assertAssignmentMatchesStoryboard(assignment, storyboard);

  const path = await writeSceneAssignment(deps, project, assignment);

  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE },
    body: scenesBody(slug, path, storyboard, assignment),
  };
}

export async function handleImportScenes(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json') {
    throw new PipelineStageError({ code: 'REQUEST_BODY_INVALID_JSON', stage: null, expected: 'a JSON object' });
  }

  const value = bodyResult.kind === 'parsed' ? bodyResult.value : {};
  const body = (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;

  const roles = parseImportRoles(body.roles);
  const replace = parseImportReplace(body.replace);

  const storyboard = await readStoredStoryboard(deps, project);
  const current = await readSceneAssignmentOrEmpty(deps, project, storyboard);

  const assetIds = await collectRawAssetIds(deps, project, roles);
  const mapping = numberedMappingFor(storyboard, assetIds);
  const merged = mergeNumberedMapping(current, storyboard, mapping, replace);

  const path = await writeSceneAssignment(deps, project, merged);
  const importBody: SceneImportBody = {
    ...scenesBody(slug, path, storyboard, merged),
    imported: mapping.matches.length,
    skipped: mapping.skipped,
  };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body: importBody };
}
