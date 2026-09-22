import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { httpStatusFor } from '../errors/http-status-for';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleGetArtifact } from './handlers/artifact-handler';
import { handleGetGenerated } from './handlers/generated-handler';
import { handleDeleteAsset, handleListAssets, handleUploadAsset } from './handlers/assets-handler';
import {
  handleCancelRenderJob,
  handleCreateRenderJob,
  handleGetRenderJob,
  handleListRenderJobs,
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
import {
  handleCreateProject,
  handleDeleteProject,
  handleGetProject,
  handleListProjects,
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
import { handleGetVoice, handlePutVoiceScene } from './handlers/voice-handler';
import { handleGetVoicePreview } from './handlers/voice-preview-handler';
import { handleListVoices } from './handlers/voices-handler';
import { handleHealth } from './health-handler';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpRequestLine, HttpResponse } from './http-message';
import type { RenderApiRuntime } from './render-api-runtime';
import { normalizePath, routeRequest } from './router';

export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  try {
    const match = routeRequest(request.method, normalizePath(request.path));

    if (match.kind === 'not-found') {
      throw new PipelineStageError({
        code: 'ROUTE_NOT_FOUND',
        stage: null,
        resource: normalizePath(request.path),
      });
    }

    if (match.kind === 'method-not-allowed') {
      throw new PipelineStageError({
        code: 'METHOD_NOT_ALLOWED',
        stage: null,
        resource: normalizePath(request.path),
        expected: match.allow.join(', '),
      });
    }

    const params = match.params ?? {};

    switch (match.id) {
      case 'health':
        return await handleHealth(deps, runtime);
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
      case 'folders.list':
        return await handleListFolders(deps, store);
      case 'folders.create':
        return await handleCreateFolder(deps, store, params, request);
      case 'folders.rename':
        return await handleRenameFolder(deps, store, params, request);
      case 'folders.delete':
        return await handleDeleteFolder(deps, store, params);
      case 'folders.categories.create':
        return await handleCreateCategory(deps, store, params, request);
      case 'folders.categories.delete':
        return await handleDeleteCategory(deps, store, params);
      case 'projects.assets.list':
        return await handleListAssets(deps, store, params);
      case 'projects.assets.upload':
        return await handleUploadAsset(deps, store, params, request, runtime);
      case 'projects.assets.delete':
        return await handleDeleteAsset(deps, store, params, request, runtime);
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
      default:
        return match.id satisfies never;
    }
  } catch (cause) {
    return toErrorResponse(cause, deps);
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
