import type { ServerConfig } from '../config/server-config';
import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { httpStatusFor } from '../errors/http-status-for';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleGetArtifact } from './handlers/artifact-handler';
import { handleGetGenerated } from './handlers/generated-handler';
import { handleDeleteAsset, handleListAssets, handleUploadAsset } from './handlers/assets-handler';
import { handleCopyAsset } from './handlers/asset-copy-handler';
import {
  handleConfirmInboxAsset,
  handleDeleteInboxAsset,
  handleListInbox,
  handleUploadToInbox,
} from './handlers/asset-inbox-handler';
import { handleProbeMedia } from './handlers/probe-handler';
import { handleExtractFrames } from './handlers/frames-handler';
import { handlePreviewImages } from './handlers/image-preview-handler';
import { handleGetProjectText, handlePutProjectText } from './handlers/project-text-handler';
import { handleImportMusic, handleSearchFreeMusic } from './handlers/music-handler';
import { handleImportMedia, handleSearchFreeMedia } from './handlers/free-media-handler';
import {
  handleCancelRenderJob,
  handleCreateRenderJob,
  handleGetRenderJob,
  handleListRenderJobs,
  handleRetryRenderJob,
} from './handlers/jobs-handler';
import {
  handleGetEditDecisionList,
  handleGetTimeline,
  handlePutEditDecisionList,
  handlePutTimeline,
} from './handlers/montage-handler';
import {
  handleCancelProducerTurn,
  handleCreateProducerMessage,
  handleGetProducer,
  handleGetProducerTurn,
} from './handlers/producer-handler';
import { handleGetOpenRouterModels } from './handlers/openrouter-models-handler';
import {
  handleDeleteOpenRouterKey,
  handleGetProducerSettings,
  handlePutOpenRouterKey,
  handlePutProducerSettings,
} from './handlers/producer-settings-handler';
import {
  handleCreateProject,
  handleDeleteProject,
  handleGetProject,
  handleListProjects,
  handlePutProjectBrand,
  handlePutProjectPlacement,
} from './handlers/projects-handler';
import {
  handleCreateCategory,
  handleCreateFolder,
  handleDeleteCategory,
  handleDeleteFolder,
  handleListFolders,
  handleRenameFolder,
} from './handlers/folders-handler';
import {
  handleGetStoryboard,
  handleGetStoryboardPrompts,
  handlePutStoryboard,
} from './handlers/storyboard-handler';
import {
  handleGetMotionBrief,
  handleGetMotionOverview,
  handleGetMotionStoryboard,
  handleListMotionBrands,
  handlePutMotionBrief,
  handlePutMotionStoryboard,
} from './handlers/motion-handler';
import {
  handleCreateBrand,
  handleDeleteBrand,
  handleGetBrand,
  handleGetBrandFile,
  handleListBrands,
  handlePutBrand,
  handleGetBrandPreviewFile,
  handlePostBrandFont,
  handlePostBrandPreview,
  handlePutBrandFile,
} from './handlers/brands-handler';
import { handleGetVoice, handlePutVoiceScene } from './handlers/voice-handler';
import { handleGetVoicePreview } from './handlers/voice-preview-handler';
import { handleListVoices } from './handlers/voices-handler';
import { handleHealth } from './health-handler';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpRequestLine, HttpResponse } from './http-message';
import { evaluateLocalAccess, sessionCookieHeaderValue } from './local-access-guard';
import type { RenderApiRuntime } from './render-api-runtime';
import { normalizePath, routeRequest } from './router';
import type { RouteMatch } from './router';
import type { RouteId } from './routes';
import { handleStaticWeb } from './static-web-handler';

const API_PATH_PREFIX = '/api';
const PATH_PARSE_BASE = 'http://render-api.invalid';
const UNPREFIXED_HEALTH_PATHNAME = '/health';

function stripApiPrefix(pathname: string): string {
  const stripped = pathname.slice(API_PATH_PREFIX.length);
  return stripped === '' ? '/' : stripped;
}

async function dispatchMatch(
  match: RouteMatch,
  pathname: string,
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  if (match.kind === 'not-found') {
    throw new PipelineStageError({ code: 'ROUTE_NOT_FOUND', stage: null, resource: pathname });
  }

  if (match.kind === 'method-not-allowed') {
    throw new PipelineStageError({
      code: 'METHOD_NOT_ALLOWED',
      stage: null,
      resource: pathname,
      expected: match.allow.join(', '),
    });
  }

  const params = match.params ?? {};

  return dispatchRoute(match.id, params, request, deps, store, runtime);
}

async function dispatchApiRoute(
  pathname: string,
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  return dispatchMatch(routeRequest(request.method, pathname), pathname, request, deps, store, runtime);
}

export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
  config: ServerConfig,
): Promise<HttpResponse> {
  try {
    const url = new URL(request.path, PATH_PARSE_BASE);
    const pathname = normalizePath(url.pathname);

    if (config.accessToken !== null) {
      const decision = evaluateLocalAccess({
        accessToken: config.accessToken,
        port: config.port,
        method: request.method,
        pathname,
        query: url.searchParams,
        headers: request.headers,
      });

      if (decision.kind === 'deny') {
        throw new PipelineStageError({ code: 'ACCESS_DENIED', stage: null });
      }

      if (decision.kind === 'redirect-with-cookie') {
        return {
          status: 302,
          headers: { location: '/', 'set-cookie': sessionCookieHeaderValue(decision.cookieValue) },
          body: undefined,
        };
      }
    }

    if (config.webRoot === null) {
      return await dispatchApiRoute(pathname, request, deps, store, runtime);
    }

    if (pathname === UNPREFIXED_HEALTH_PATHNAME) {
      return await dispatchApiRoute(pathname, request, deps, store, runtime);
    }

    if (pathname === API_PATH_PREFIX || pathname.startsWith(`${API_PATH_PREFIX}/`)) {
      const strippedPathname = normalizePath(stripApiPrefix(pathname));
      return await dispatchApiRoute(strippedPathname, request, deps, store, runtime);
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return await handleStaticWeb(config.webRoot, pathname);
    }

    throw new PipelineStageError({ code: 'ROUTE_NOT_FOUND', stage: null, resource: pathname });
  } catch (cause) {
    return toErrorResponse(cause, deps);
  }
}

async function dispatchRoute(
  id: RouteId,
  params: Readonly<Record<string, string>>,
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  switch (id) {
      case 'health':
        return await handleHealth(deps, store, runtime);
      case 'voices.list':
        return await handleListVoices(deps);
      case 'voices.preview':
        return await handleGetVoicePreview(deps, params, runtime);
      case 'projects.list':
        return await handleListProjects(deps, store);
      case 'projects.create':
        return await handleCreateProject(deps, store, params, request);
      case 'projects.detail':
        return await handleGetProject(deps, store, params);
      case 'projects.delete':
        return await handleDeleteProject(deps, store, params);
      case 'projects.placement.put':
        return await handlePutProjectPlacement(deps, store, params, request);
      case 'projects.brand.put':
        return await handlePutProjectBrand(deps, store, params, request);
      case 'brands.list':
        return await handleListBrands(deps, store);
      case 'brands.create':
        return await handleCreateBrand(deps, store, request);
      case 'brands.detail':
        return await handleGetBrand(deps, store, params);
      case 'brands.update':
        return await handlePutBrand(deps, store, params, request);
      case 'brands.delete':
        return await handleDeleteBrand(deps, store, params);
      case 'brands.files.put':
        return await handlePutBrandFile(deps, store, params, request);
      case 'brands.files.get':
        return await handleGetBrandFile(deps, store, params, request);
      case 'brands.preview.create':
        return await handlePostBrandPreview(deps, store, runtime, params, request);
      case 'brands.preview.get':
        return await handleGetBrandPreviewFile(deps, store, params, request);
      case 'brands.fonts.add':
        return await handlePostBrandFont(deps, store, params, request);
      case 'folders.list':
        return await handleListFolders(deps);
      case 'folders.create':
        return await handleCreateFolder(deps, params, request);
      case 'folders.rename':
        return await handleRenameFolder(deps, params, request);
      case 'folders.delete':
        return await handleDeleteFolder(deps, params);
      case 'folders.categories.create':
        return await handleCreateCategory(deps, params, request);
      case 'folders.categories.delete':
        return await handleDeleteCategory(deps, params);
      case 'projects.assets.list':
        return await handleListAssets(deps, store, params);
      case 'projects.assets.upload':
        return await handleUploadAsset(deps, store, params, request, runtime);
      case 'projects.assets.delete':
        return await handleDeleteAsset(deps, store, params, request, runtime);
      case 'projects.assets.copy':
        return await handleCopyAsset(deps, store, params, request, runtime);
      case 'projects.inbox.list':
        return await handleListInbox(deps, store, params);
      case 'projects.inbox.upload':
        return await handleUploadToInbox(deps, store, params, request, runtime);
      case 'projects.inbox.delete':
        return await handleDeleteInboxAsset(deps, store, params, runtime);
      case 'projects.inbox.confirm':
        return await handleConfirmInboxAsset(deps, store, params, request, runtime);
      case 'projects.probe':
        return await handleProbeMedia(deps, store, params, request);
      case 'projects.frames':
        return await handleExtractFrames(deps, store, params, request);
      case 'projects.text.get':
        return await handleGetProjectText(deps, store, params, request);
      case 'projects.text.put':
        return await handlePutProjectText(deps, store, params, request);
      case 'projects.music.search':
        return await handleSearchFreeMusic(deps, store, params, request, runtime);
      case 'projects.music.import':
        return await handleImportMusic(deps, store, params, request, runtime);
      case 'projects.media.search':
        return await handleSearchFreeMedia(deps, store, params, request, runtime);
      case 'projects.media.import':
        return await handleImportMedia(deps, store, params, request, runtime);
      case 'projects.images.preview':
        return await handlePreviewImages(deps, store, params, request);
      case 'projects.timeline.get':
        return await handleGetTimeline(deps, store, params);
      case 'projects.timeline.put':
        return await handlePutTimeline(deps, store, params, request);
      case 'projects.edl.get':
        return await handleGetEditDecisionList(deps, store, params);
      case 'projects.edl.put':
        return await handlePutEditDecisionList(deps, store, params, request);
      case 'projects.files.get':
        return await handleGetArtifact(deps, store, params, request);
      case 'projects.generated.get':
        return await handleGetGenerated(deps, store, params);
      case 'projects.storyboard.get':
        return await handleGetStoryboard(deps, store, params);
      case 'projects.storyboard.put':
        return await handlePutStoryboard(deps, store, params, request);
      case 'projects.storyboard.prompts':
        return await handleGetStoryboardPrompts(deps, store, params);
      case 'projects.voice.get':
        return await handleGetVoice(deps, store, params);
      case 'projects.voice.scene.put':
        return await handlePutVoiceScene(deps, store, params, request);
      case 'motion.brands.list':
        return await handleListMotionBrands(deps);
      case 'projects.motion.brief.get':
        return await handleGetMotionBrief(deps, store, params);
      case 'projects.motion.brief.put':
        return await handlePutMotionBrief(deps, store, params, request);
      case 'projects.motion.storyboard.get':
        return await handleGetMotionStoryboard(deps, store, params);
      case 'projects.motion.storyboard.put':
        return await handlePutMotionStoryboard(deps, store, params, request);
      case 'projects.motion.overview.get':
        return await handleGetMotionOverview(deps, store, params);
      case 'settings.producer.get':
        return await handleGetProducerSettings(deps, runtime);
      case 'settings.producer.put':
        return await handlePutProducerSettings(deps, runtime, request);
      case 'settings.producer.openrouterModels.get':
        return await handleGetOpenRouterModels(deps, runtime, request);
      case 'settings.producer.openrouterKey.put':
        return await handlePutOpenRouterKey(deps, request);
      case 'settings.producer.openrouterKey.delete':
        return await handleDeleteOpenRouterKey(deps);
      case 'projects.producer.get':
        return await handleGetProducer(deps, store, params, runtime);
      case 'projects.producer.messages':
        return await handleCreateProducerMessage(deps, store, params, request, runtime);
      case 'projects.producer.turn.get':
        return await handleGetProducerTurn(params, runtime);
      case 'projects.producer.turn.cancel':
        return await handleCancelProducerTurn(params, runtime);
      case 'projects.jobs.create':
        return await handleCreateRenderJob(deps, store, params, request, runtime);
      case 'projects.jobs.list':
        return await handleListRenderJobs(params, runtime);
      case 'jobs.detail':
        return await handleGetRenderJob(params, runtime);
      case 'jobs.cancel':
        return await handleCancelRenderJob(params, runtime);
      case 'jobs.retry':
        return await handleRetryRenderJob(deps, store, params, runtime);
      default:
        return id satisfies never;
    }
}

export function toErrorResponse(cause: unknown, deps: RenderApiDependencies): HttpResponse {
  const error = toErrorPayload(cause);
  deps.logger.error({ event: 'request-failed', detail: { code: error.code } });

  return {
    status: httpStatusFor(error.code),
    headers:
      error.code === 'METHOD_NOT_ALLOWED' && error.expected !== undefined
        ? { 'content-type': JSON_CONTENT_TYPE, allow: error.expected }
        : { 'content-type': JSON_CONTENT_TYPE },
    body: { error },
  };
}
