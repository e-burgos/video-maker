import { describeProducerModel } from '../../config/producer-config';
import type { ProducerModelOption } from '../../config/producer-config';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { readProducerConversation, readProducerSession } from '../../producer/producer-store';
import type { ProducerMessage, ProducerSession } from '../../producer/producer-documents';
import type { ProducerTurnRecord } from '../../producer/producer-turn-registry';
import {
  assertProducerMessageText,
  assertProducerModel,
  startProducerTurn,
} from '../../producer/run-producer-turn';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

export interface ProducerModelCatalog {
  readonly default: string;
  readonly allowed: readonly ProducerModelOption[];
}

export interface ProducerConversationBody {
  readonly slug: string;
  readonly messages: readonly ProducerMessage[];
  readonly session: ProducerSession | null;
  readonly activeTurn: ProducerTurnRecord | null;
  readonly models: ProducerModelCatalog;
}

export interface ProducerTurnAcceptedBody {
  readonly slug: string;
  readonly turnId: string;
  readonly startedAt: string;
  readonly status: 'running';
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function turnOfProject(runtime: RenderApiRuntime, slug: string, turnId: string): ProducerTurnRecord {
  const record = runtime.producerTurns.get(turnId);
  if (record.slug !== slug) {
    throw new PipelineStageError({
      code: 'PRODUCER_TURN_NOT_FOUND',
      stage: null,
      resource: turnId,
      expected: `a turn of project ${slug}`,
    });
  }
  return record;
}

export async function handleGetProducer(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const body: ProducerConversationBody = {
    slug,
    messages: readProducerConversation(deps, project),
    session: readProducerSession(deps, project),
    activeTurn: runtime.producerTurns.activeFor(slug),
    models: {
      default: runtime.producer.model,
      allowed: runtime.producer.models.map(describeProducerModel),
    },
  };

  return jsonResponse(200, body);
}

export async function handleCreateProducerMessage(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
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
  if (bodyResult.kind !== 'parsed') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const value = bodyResult.value as Record<string, unknown>;
  const text = assertProducerMessageText(value.text);
  const model = assertProducerModel(value.model, runtime.producer);
  const project = await resolveExistingProject(deps, store, slug);

  const started = await startProducerTurn(deps, runtime.producerTurns, {
    project,
    text,
    model,
    config: runtime.producer,
  });
  void started.completed;

  const body: ProducerTurnAcceptedBody = {
    slug,
    turnId: started.turnId,
    startedAt: started.startedAt,
    status: 'running',
  };

  return jsonResponse(202, body);
}

export async function handleGetProducerTurn(
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  return jsonResponse(200, turnOfProject(runtime, slug, params.turnId ?? ''));
}

export async function handleCancelProducerTurn(
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const turnId = params.turnId ?? '';
  turnOfProject(runtime, slug, turnId);

  return jsonResponse(202, runtime.producerTurns.requestCancel(turnId));
}
