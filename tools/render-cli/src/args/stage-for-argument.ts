import type { Stage } from '../errors/render-cli-error';
import type { ParsedCommand } from './parse-cli-args';

export type CliArgument = 'project-root' | 'preset' | 'seed';

type CommandName = ParsedCommand['command'];

const STAGE_FOR_ARGUMENT: Record<CommandName, Record<CliArgument, Stage>> = {
  ingest: { 'project-root': 'ingest', preset: 'ingest', seed: 'ingest' },
  plan: { 'project-root': 'plan', preset: 'plan', seed: 'plan' },
  render: { 'project-root': 'render', preset: 'render', seed: 'render' },
  run: { 'project-root': 'ingest', preset: 'plan', seed: 'plan' },
};

export function stageForArgument(command: CommandName, argument: CliArgument): Stage {
  return STAGE_FOR_ARGUMENT[command][argument];
}
