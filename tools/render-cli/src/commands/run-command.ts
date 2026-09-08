import type { MediaProject } from '@video-maker/auto-montage';

import type { PlanOptions } from '../args/parse-cli-args';
import type { CliDependencies } from '../deps/cli-dependencies';
import type { RunReport } from '../report/cli-report';

import { ingestCommand } from './ingest-command';
import { planCommand } from './plan-command';
import { renderCommand } from './render-command';

export async function runCommand(
  project: MediaProject,
  options: PlanOptions,
  deps: CliDependencies,
): Promise<RunReport> {
  const ingest = await ingestCommand(project, deps);
  const plan = await planCommand(project, options, deps);
  const render = await renderCommand(project, deps);
  return { kind: 'run', ingest, plan, render };
}
