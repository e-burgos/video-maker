import { resolveMediaProject } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import { parseCliArgs } from './args/parse-cli-args';
import type { ParsedCommand } from './args/parse-cli-args';
import { ingestCommand } from './commands/ingest-command';
import { planCommand } from './commands/plan-command';
import { renderCommand } from './commands/render-command';
import { runCommand } from './commands/run-command';
import type { CliDependencies } from './deps/cli-dependencies';
import { exitCodeFor } from './errors/exit-code-for';
import { formatCliError } from './errors/format-cli-error';
import type { CliReport } from './report/cli-report';
import { formatReport } from './report/format-report';

export interface CliOutcome {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

async function dispatch(parsed: ParsedCommand, project: MediaProject, deps: CliDependencies): Promise<CliReport> {
  switch (parsed.command) {
    case 'ingest':
      return ingestCommand(project, deps);
    case 'plan':
      return planCommand(project, parsed.options, deps);
    case 'render':
      return renderCommand(project, deps);
    case 'run':
      return runCommand(project, parsed.options, deps);
  }
}

export async function runCli(
  argv: readonly string[],
  resolveProjectRoot: (raw: string) => string,
  deps: CliDependencies,
): Promise<CliOutcome> {
  try {
    const parsed = parseCliArgs(argv);
    const project = resolveMediaProject(resolveProjectRoot(parsed.projectRoot));
    const report = await dispatch(parsed, project, deps);
    return { exitCode: 0, stdout: formatReport(report), stderr: [] };
  } catch (error) {
    return { exitCode: exitCodeFor(error), stdout: [], stderr: formatCliError(error) };
  }
}
