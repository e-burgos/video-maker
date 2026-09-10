import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { renderStoryboardPrompts } from '../../storyboard/render-storyboard-prompts';
import { storyboardPath } from '../../storyboard/storyboard-paths';
import { parseStoryboard, readStoredStoryboard, writeStoryboard } from '../../storyboard/storyboard-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE, plainTextResponse } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

export interface StoryboardWriteBody {
  readonly slug: string;
  readonly path: string;
}

export async function handleGetStoryboard(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE },
    body: await readStoredStoryboard(deps, project),
  };
}

export async function handlePutStoryboard(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
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
      expected: 'a JSON object',
    });
  }

  const document = parseStoryboard(bodyResult.value, storyboardPath());
  const project = await resolveExistingProject(deps, store, slug);
  const writtenPath = await writeStoryboard(deps, project, document);
  const body: StoryboardWriteBody = { slug, path: writtenPath };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

export async function handleGetStoryboardPrompts(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);
  const document = await readStoredStoryboard(deps, project);

  return plainTextResponse(200, renderStoryboardPrompts(document));
}
