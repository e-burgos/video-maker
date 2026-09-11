import type { Stage } from '../errors/render-cli-error';
import type { ParsedCommand } from './parse-cli-args';

export type CliArgument =
  | 'project-root'
  | 'preset'
  | 'seed'
  | 'script'
  | 'logo'
  | 'format'
  | 'voice'
  | 'prune-silences';

type CommandName = ParsedCommand['command'];

const STAGE_FOR_ARGUMENT: Record<CommandName, Record<CliArgument, Stage>> = {
  ingest: {
    'project-root': 'ingest',
    preset: 'ingest',
    seed: 'ingest',
    script: 'ingest',
    logo: 'ingest',
    format: 'ingest',
    voice: 'ingest',
    'prune-silences': 'ingest',
  },
  plan: {
    'project-root': 'plan',
    preset: 'plan',
    seed: 'plan',
    script: 'plan',
    logo: 'plan',
    format: 'plan',
    voice: 'plan',
    'prune-silences': 'plan',
  },
  render: {
    'project-root': 'render',
    preset: 'render',
    seed: 'render',
    script: 'render',
    logo: 'render',
    format: 'render',
    voice: 'render',
    'prune-silences': 'render',
  },
  run: {
    'project-root': 'ingest',
    preset: 'plan',
    seed: 'plan',
    script: 'plan',
    logo: 'plan',
    format: 'plan',
    voice: 'plan',
    'prune-silences': 'plan',
  },
};

export function stageForArgument(command: CommandName, argument: CliArgument): Stage {
  return STAGE_FOR_ARGUMENT[command][argument];
}
