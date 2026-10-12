import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { listReferenceBriefs, readReferenceBrief } from '../../reference/reference-store';
import type { StoredReference } from '../../reference/reference-store';
import { isPortableFileName } from '../../store/asset-path';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function toListItem(reference: StoredReference): Record<string, unknown> {
  const { brief } = reference;
  return {
    name: reference.name,
    file: brief.file,
    briefFile: reference.briefFile,
    durationSec: brief.durationSec,
    scenes: brief.scenes.length,
    cutsPerMinute: brief.pace.cutsPerMinute,
    hasVoice: brief.voice !== null,
    summary: brief.summary,
    createdAt: brief.createdAt,
  };
}

export async function handleListReferences(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);
  const references = await listReferenceBriefs(deps.storage, project);
  return jsonResponse(200, { references: references.map(toListItem) });
}

export async function handleGetReference(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  const name = params.name ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const stored = isPortableFileName(name) ? await readReferenceBrief(deps.storage, project, name) : null;
  if (stored === null) {
    throw new PipelineStageError({ code: 'REFERENCE_NOT_FOUND', stage: null, resource: name });
  }
  return jsonResponse(200, stored.brief);
}
