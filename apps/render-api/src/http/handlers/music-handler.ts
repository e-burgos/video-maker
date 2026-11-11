import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { MAX_SEARCH_FREE_MUSIC_RESULTS, MIN_SEARCH_FREE_MUSIC_RESULTS } from '@video-maker/producer-tools';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { resolveUniqueFileName } from '../../media-search/download-shared';
import { brandBankFileName, searchBrandMusicBank } from '../../music/brand-music-bank';
import type { FreeMusicResult } from '../../music/brand-music-bank';
import { downloadCommonsAudioFile } from '../../music/import-music';
import { searchCommonsMusic } from '../../music/commons-music-search';
import { searchOpenverseMusic } from '../../music/openverse-music-search';
import { recordMusicUse } from '../../music/music-usage-log';
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
    hint: 'No free music source (Openverse, Wikimedia Commons) answered with a usable response',
    cause,
  });
}

function toPublicResult(result: FreeMusicResult) {
  return {
    resultId: result.resultId,
    title: result.title,
    durationMs: result.durationMs,
    license: result.license,
    author: result.author,
    pageUrl: result.pageUrl,
    source: result.source,
  };
}

type FreeMusicSource = (slots: number) => Promise<readonly FreeMusicResult[]>;

function freeMusicSources(deps: RenderApiDependencies, mood: string): readonly FreeMusicSource[] {
  return [
    (slots) => searchOpenverseMusic(deps.fetchRemote, mood, slots),
    async (slots) => (await searchCommonsMusic(deps.fetchRemote, mood, slots)).map((result) => ({ ...result, source: 'commons' as const })),
  ];
}

async function searchFreeSourcesToFill(deps: RenderApiDependencies, mood: string, slots: number, bankFound: boolean): Promise<FreeMusicResult[]> {
  const found: FreeMusicResult[] = [];
  const failures: unknown[] = [];
  for (const search of freeMusicSources(deps, mood)) {
    const missing = slots - found.length;
    if (missing <= 0) {
      break;
    }
    try {
      found.push(...(await search(missing)));
    } catch (cause) {
      failures.push(cause);
    }
  }
  const everySourceFailed = failures.length === freeMusicSources(deps, mood).length;
  if (everySourceFailed && !bankFound) {
    throw musicSourceUnavailable(failures.at(-1));
  }
  return found;
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

  const brandId = deps.localStore.projects.get(slug)?.brand ?? null;
  const bank = await searchBrandMusicBank(deps, store, brandId, mood, maxResults);
  const results = [...bank, ...(await searchFreeSourcesToFill(deps, mood, maxResults - bank.length, bank.length > 0))];

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
    const downloaded =
      result.source === 'brand-bank'
        ? await copyBrandBankTrack(deps, project, result)
        : await downloadCommonsAudioFile(deps.storage, deps.fetchRemote, project, result).catch((cause: unknown) => {
            throw musicSourceUnavailable(cause);
          });

    const credit: MusicCreditEntry = {
      kind: 'music',
      path: downloaded.relativePath,
      title: result.creditTitle ?? result.title,
      author: result.author,
      license: result.license,
      sourceUrl: result.pageUrl,
      importedAt: deps.clock.nowIso(),
    };

    await appendMusicCredit(deps.storage, project, credit);
    if (result.brandId !== undefined && result.trackId !== undefined) {
      await recordMusicUse(deps.storage, store.mediaRoot, result.brandId, result.trackId, deps.clock.nowIso());
    }

    return jsonResponse(200, { path: downloaded.relativePath, credit });
  });
}

async function copyBrandBankTrack(
  deps: RenderApiDependencies,
  project: MediaProject,
  result: FreeMusicResult,
): Promise<{ readonly relativePath: string; readonly absolutePath: string }> {
  if (result.localPath === undefined || (await deps.storage.stat(result.localPath))?.kind !== 'file') {
    throw new PipelineStageError({ code: 'MUSIC_RESULT_UNKNOWN', stage: null, resource: result.resultId, expected: 'a brand music track that is still on disk' });
  }
  const audioDirectory = toAbsolutePath(project, 'raw/audio');
  await deps.storage.ensureDirectory(audioDirectory);
  const fileName = await resolveUniqueFileName(deps.storage, audioDirectory, brandBankFileName(result));
  const relativePath = `raw/audio/${fileName}`;
  const absolutePath = toAbsolutePath(project, relativePath);
  await deps.storage.copyFile(result.localPath, absolutePath);
  return { relativePath, absolutePath };
}
