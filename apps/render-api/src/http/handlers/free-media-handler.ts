import { MAX_SEARCH_FREE_MEDIA_RESULTS, MIN_SEARCH_FREE_MEDIA_RESULTS } from '@video-maker/producer-tools';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { downloadFreeMediaFile } from '../../media-search/import-free-media';
import { searchFreeMedia } from '../../media-search/free-media-search';
import type { FreeMediaKind, FreeMediaResult } from '../../media-search/free-media-result';
import { appendMediaCredit } from '../../music/project-credits';
import type { MediaCreditEntry } from '../../music/project-credits';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import { queryValue } from '../query-value';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

const FREE_MEDIA_KINDS: readonly FreeMediaKind[] = ['video', 'image'];

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function mediaSourceUnavailable(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'MEDIA_SOURCE_UNAVAILABLE',
    stage: null,
    hint: 'Neither Wikimedia Commons nor the NASA Image and Video Library answered with a usable response',
    cause,
  });
}

function toPublicResult(result: FreeMediaResult): Omit<FreeMediaResult, 'downloadUrl'> {
  return {
    resultId: result.resultId,
    source: result.source,
    kind: result.kind,
    title: result.title,
    license: result.license,
    author: result.author,
    pageUrl: result.pageUrl,
    durationMs: result.durationMs,
    width: result.width,
    height: result.height,
  };
}

function parseKind(value: string | null): FreeMediaKind {
  if (value === null || !FREE_MEDIA_KINDS.includes(value as FreeMediaKind)) {
    throw invalidInput('kind', 'either "video" or "image" in the kind query parameter');
  }
  return value as FreeMediaKind;
}

export async function handleSearchFreeMedia(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const query = queryValue(request.path, 'query');
  if (query === null || query.trim().length === 0) {
    throw invalidInput('query', 'a non-empty query in the query query parameter');
  }

  const kind = parseKind(queryValue(request.path, 'kind'));

  const rawMaxResults = queryValue(request.path, 'maxResults');
  const maxResults = rawMaxResults === null ? Number.NaN : Number(rawMaxResults);
  if (
    !Number.isInteger(maxResults) ||
    maxResults < MIN_SEARCH_FREE_MEDIA_RESULTS ||
    maxResults > MAX_SEARCH_FREE_MEDIA_RESULTS
  ) {
    throw invalidInput(
      'maxResults',
      `an integer between ${MIN_SEARCH_FREE_MEDIA_RESULTS} and ${MAX_SEARCH_FREE_MEDIA_RESULTS} in the maxResults query parameter`,
    );
  }

  await resolveExistingProject(deps, store, slug);

  let results: readonly FreeMediaResult[];
  try {
    results = await searchFreeMedia(deps.fetchRemote, query, kind, maxResults);
  } catch (cause) {
    throw mediaSourceUnavailable(cause);
  }

  const nowMs = Date.parse(deps.clock.nowIso());
  runtime.freeMediaSearchCache.store(slug, results, nowMs);

  return jsonResponse(200, { results: results.map(toPublicResult) });
}

interface ImportMediaRequestBody {
  readonly resultId: string;
}

function parseImportMediaBody(value: unknown): ImportMediaRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const resultId = bodyObject.resultId;
  if (typeof resultId !== 'string' || resultId.trim().length === 0) {
    throw invalidInput('resultId', 'a non-empty resultId from a previous search_free_media call');
  }
  return { resultId };
}

export async function handleImportMedia(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { resultId } = parseImportMediaBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);

  const nowMs = Date.parse(deps.clock.nowIso());
  const result = runtime.freeMediaSearchCache.resolve(slug, resultId, nowMs);
  if (result === null) {
    throw new PipelineStageError({
      code: 'MEDIA_RESULT_UNKNOWN',
      stage: null,
      resource: resultId,
      expected: 'a resultId from a search_free_media call made within the last hour for this project',
    });
  }

  return runtime.uploadSerializer.run(slug, async () => {
    const downloaded = await downloadFreeMediaFile(deps.storage, deps.fetchRemote, project, result).catch(
      (cause: unknown) => {
        throw mediaSourceUnavailable(cause);
      },
    );

    const credit: MediaCreditEntry = {
      kind: result.kind,
      path: downloaded.relativePath,
      title: result.title,
      author: result.author,
      license: result.license,
      sourceUrl: result.pageUrl,
      importedAt: deps.clock.nowIso(),
    };

    await appendMediaCredit(deps.storage, project, credit);

    return jsonResponse(200, { path: downloaded.relativePath, credit });
  });
}
