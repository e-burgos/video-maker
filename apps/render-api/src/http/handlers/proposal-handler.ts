import { approveProposalConcept } from '@video-maker/timeline-core';
import type { ProductionProposal } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { resolveProducerEngineForEstimate } from '../../proposal/estimate-engine';
import { estimateProduction } from '../../proposal/estimate-production';
import type { ProductionEstimate } from '../../proposal/estimate-production';
import { HISTORY_JOB_KINDS, HISTORY_ROW_LIMIT, historySamplesFrom } from '../../proposal/job-history';
import { productionProposalPath } from '../../proposal/proposal-paths';
import { parsePendingProposal, readProductionProposal, writeProductionProposal } from '../../proposal/proposal-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

export interface ProposalEngineBody {
  readonly kind: 'claude-cli' | 'openrouter' | 'none';
  readonly model: string | null;
}

export interface ProposalBody {
  readonly slug: string;
  readonly path: string;
  readonly proposal: ProductionProposal | null;
  readonly estimates: Readonly<Record<string, ProductionEstimate>>;
  readonly engine: ProposalEngineBody;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

async function buildProposalBody(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
  slug: string,
  proposal: ProductionProposal | null,
): Promise<ProposalBody> {
  const engine = await resolveProducerEngineForEstimate(deps, runtime);
  const history = historySamplesFrom(deps.localStore.jobs.listSucceededByKinds(HISTORY_JOB_KINDS, HISTORY_ROW_LIMIT));
  const estimates = Object.fromEntries(
    (proposal?.concepts ?? []).map((concept) => [concept.id, estimateProduction(concept, history, engine)]),
  );

  return {
    slug,
    path: productionProposalPath(),
    proposal,
    estimates,
    engine: { kind: engine.kind, model: engine.kind === 'openrouter' ? engine.model : null },
  };
}

export async function handleGetProposal(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  return jsonResponse(200, await buildProposalBody(deps, runtime, slug, await readProductionProposal(deps, project)));
}

export async function handlePutProposal(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const body = await readJsonObjectBody(request);
  const proposal = parsePendingProposal({ recommendedId: body.recommendedId, concepts: body.concepts });

  const project = await resolveExistingProject(deps, store, slug);
  await writeProductionProposal(deps, project, proposal);

  return jsonResponse(200, await buildProposalBody(deps, runtime, slug, proposal));
}

function conceptIdFrom(body: Readonly<Record<string, unknown>>): string {
  if (typeof body.conceptId !== 'string' || body.conceptId.length === 0) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'conceptId',
      expected: 'a JSON object { conceptId: string } naming one concept of the proposal',
    });
  }
  return body.conceptId;
}

export async function handleApproveProposal(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const conceptId = conceptIdFrom(await readJsonObjectBody(request));
  const project = await resolveExistingProject(deps, store, slug);
  const stored = await readProductionProposal(deps, project);
  if (stored === null) {
    throw new PipelineStageError({ code: 'PROPOSAL_NOT_FOUND', stage: null, resource: productionProposalPath() });
  }

  const approved = approveProposalConcept(stored, conceptId, deps.clock.nowIso());
  if (approved === null) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'conceptId',
      expected: `one of ${stored.concepts.map((concept) => concept.id).join(', ')}`,
    });
  }
  await writeProductionProposal(deps, project, approved);

  return jsonResponse(200, await buildProposalBody(deps, runtime, slug, approved));
}
