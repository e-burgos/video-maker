import type { OpenRouterCatalogModel } from '../../producer/openrouter-model-catalog';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { queryValue } from '../query-value';
import type { RenderApiRuntime } from '../render-api-runtime';

const OPENROUTER_MODEL_SCOPES = ['all', 'recommended'] as const;
type OpenRouterModelScope = (typeof OPENROUTER_MODEL_SCOPES)[number];

const OPENROUTER_MODEL_SORTS = ['price', 'name'] as const;
type OpenRouterModelSort = (typeof OPENROUTER_MODEL_SORTS)[number];

export interface OpenRouterModelsBody {
  readonly models: readonly OpenRouterCatalogModel[];
  readonly fetchedAt: string;
  readonly stale: boolean;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function assertScope(value: string | null): OpenRouterModelScope {
  if (value === null) {
    return 'all';
  }
  if (!(OPENROUTER_MODEL_SCOPES as readonly string[]).includes(value)) {
    throw invalidInput('scope', `one of ${OPENROUTER_MODEL_SCOPES.join(', ')} in the scope query parameter`);
  }
  return value as OpenRouterModelScope;
}

function assertSort(value: string | null): OpenRouterModelSort | null {
  if (value === null) {
    return null;
  }
  if (!(OPENROUTER_MODEL_SORTS as readonly string[]).includes(value)) {
    throw invalidInput('sort', `one of ${OPENROUTER_MODEL_SORTS.join(', ')} in the sort query parameter`);
  }
  return value as OpenRouterModelSort;
}

function matchesQuery(model: OpenRouterCatalogModel, needle: string): boolean {
  return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle);
}

function sortModels(
  models: readonly OpenRouterCatalogModel[],
  sort: OpenRouterModelSort,
): readonly OpenRouterCatalogModel[] {
  const sorted = [...models];
  if (sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => a.pricing.promptPerMTokUsd - b.pricing.promptPerMTokUsd);
  }
  return sorted;
}

export async function handleGetOpenRouterModels(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const scope = assertScope(queryValue(request.path, 'scope'));
  const sort = assertSort(queryValue(request.path, 'sort'));
  const needle = (queryValue(request.path, 'q') ?? '').trim().toLowerCase();

  const nowMs = Date.parse(deps.clock.nowIso());
  const { models: allModels, fetchedAt, stale } = await runtime.openRouterModelCatalog.load(deps.fetchRemote, nowMs);

  const scoped = scope === 'recommended' ? allModels.filter((model) => model.recommended) : allModels;
  const filtered = needle === '' ? scoped : scoped.filter((model) => matchesQuery(model, needle));
  const ordered = sort === null ? filtered : sortModels(filtered, sort);

  const body: OpenRouterModelsBody = { models: ordered, fetchedAt, stale };
  return jsonResponse(200, body);
}
