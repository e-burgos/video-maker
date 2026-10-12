import { serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { ProductionProposalDraftSchema, ProductionProposalSchema, pendingProposalFrom } from '@video-maker/timeline-core';
import type { ProductionProposal } from '@video-maker/timeline-core';
import { dirname } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { productionProposalPath } from './proposal-paths';

function invalidProposal(expected: string): PipelineStageError {
  return new PipelineStageError({
    code: 'INVALID_INPUT',
    stage: null,
    resource: productionProposalPath(),
    expected,
  });
}

function describeIssues(error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] }): string {
  return error.issues.map((issue) => `${issue.path.map(String).join('.')} ${issue.message}`).join('; ');
}

export function parsePendingProposal(value: unknown): ProductionProposal {
  const parsed = ProductionProposalDraftSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidProposal(`{ recommendedId, concepts: 2 to 3 concepts }: ${describeIssues(parsed.error)}`);
  }
  return pendingProposalFrom(parsed.data);
}

export async function readProductionProposal(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<ProductionProposal | null> {
  const absolutePath = toAbsolutePath(project, productionProposalPath());
  if ((await deps.storage.stat(absolutePath)) === null) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await deps.storage.readTextFile(absolutePath));
  } catch {
    throw invalidProposal('valid JSON');
  }
  const parsed = ProductionProposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw invalidProposal(describeIssues(parsed.error));
  }
  return parsed.data;
}

export async function writeProductionProposal(
  deps: RenderApiDependencies,
  project: MediaProject,
  proposal: ProductionProposal,
): Promise<void> {
  const absolutePath = toAbsolutePath(project, productionProposalPath());
  await deps.storage.ensureDirectory(dirname(absolutePath));
  await deps.storage.writeTextFile(absolutePath, serializeMontageDocument(ProductionProposalSchema.parse(proposal)));
}
