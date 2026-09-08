import type { MediaProject } from '@video-maker/auto-montage';

import type { CliDependencies } from '../deps/cli-dependencies';
import { assertTimelineExists } from '../pipeline/assert-project-preconditions';
import { readTimelineDocument } from '../pipeline/read-timeline-document';
import { resolveRenderTarget } from '../pipeline/resolve-render-target';
import type { RenderReport } from '../report/cli-report';
import { toRenderReport } from '../report/to-reports';

export async function renderCommand(project: MediaProject, deps: CliDependencies): Promise<RenderReport> {
  await assertTimelineExists(project, deps);
  const timeline = await readTimelineDocument(project, deps);
  const target = resolveRenderTarget(project);
  const outcome = await deps.renderTimeline(timeline, target);
  return toRenderReport(outcome, project);
}
