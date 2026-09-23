import { MAX_SEARCH_FREE_MUSIC_RESULTS, MIN_SEARCH_FREE_MUSIC_RESULTS } from '@video-maker/producer-tools';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { downloadCommonsAudioFile } from '../../music/import-music';
import { searchCommonsMusic } from '../../music/commons-music-search';
import type { CommonsMusicResult } from '../../music/commons-music-search';
import { appendMusicCredit } from '../../music/project-credits';
import type { MusicCreditEntry } from '../../music/project-credits';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import { queryValue } from '../query-value';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function musicSourceUnavailable(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'MUSIC_SOURCE_UNAVAILABLE',
    stage: null,
    hint: 'Wikimedia Commons did not answer with a usable response',
    cause,
  });
}

function toPublicResult(result: CommonsMusicResult): Omit<CommonsMusicResult, 'downloadUrl'> {
  return {
    resultId: result.resultId,
    title: result.title,
    durationMs: result.durationMs,
    license: result.license,
    author: result.author,
    pageUrl: result.pageUrl,
  };
}

export async function handleSearchFreeMusic(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const mood = queryValue(request.path, 'mood');
  if (mood === null || mood.trim().length === 0) {
    throw invalidInput('mood', 'a non-empty mood in the mood query parameter');
  }

  const rawMaxResults = queryValue(request.path, 'maxResults');
  const maxResults = rawMaxResults === null ? Number.NaN : Number(rawMaxResults);
  if (
    !Number.isInteger(maxResults) ||
    maxResults < MIN_SEARCH_FREE_MUSIC_RESULTS ||
    maxResults > MAX_SEARCH_FREE_MUSIC_RESULTS
  ) {
    throw invalidInput(
      'maxResults',
      `an integer between ${MIN_SEARCH_FREE_MUSIC_RESULTS} and ${MAX_SEARCH_FREE_MUSIC_RESULTS} in the maxResults query parameter`,
    );
  }

  await resolveExistingProject(deps, store, slug);

  let results: readonly CommonsMusicResult[];
  try {
    results = await searchCommonsMusic(deps.fetchRemote, mood, maxResults);
  } catch (cause) {
    throw musicSourceUnavailable(cause);
  }

  const nowMs = Date.parse(deps.clock.nowIso());
  runtime.musicSearchCache.store(slug, results, nowMs);

  return jsonResponse(200, { results: results.map(toPublicResult) });
}

interface ImportMusicRequestBody {
  readonly resultId: string;
}

function parseImportMusicBody(value: unknown): ImportMusicRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const resultId = bodyObject.resultId;
  if (typeof resultId !== 'string' || resultId.trim().length === 0) {
    throw invalidInput('resultId', 'a non-empty resultId from a previous search_free_music call');
  }
  return { resultId };
}

export async function handleImportMusic(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { resultId } = parseImportMusicBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);

  const nowMs = Date.parse(deps.clock.nowIso());
  const result = runtime.musicSearchCache.resolve(slug, resultId, nowMs);
  if (result === null) {
    throw new PipelineStageError({
      code: 'MUSIC_RESULT_UNKNOWN',
      stage: null,
      resource: resultId,
      expected: 'a resultId from a search_free_music call made within the last hour for this project',
    });
  }

  return runtime.uploadSerializer.run(slug, async () => {
    const downloaded = await downloadCommonsAudioFile(deps.storage, deps.fetchRemote, project, result).catch(
      (cause: unknown) => {
        throw musicSourceUnavailable(cause);
      },
    );

    const credit: MusicCreditEntry = {
      kind: 'music',
      path: downloaded.relativePath,
      title: result.title,
      author: result.author,
      license: result.license,
      sourceUrl: result.pageUrl,
      importedAt: deps.clock.nowIso(),
    };

    await appendMusicCredit(deps.storage, project, credit);

    return jsonResponse(200, { path: downloaded.relativePath, credit });
  });
}
