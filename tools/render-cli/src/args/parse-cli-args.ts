import { parseArgs } from 'node:util';
import type { MontagePresetName } from '@video-maker/auto-montage';

import { CliArgumentError } from '../errors/cli-argument-error';
import { CliUsageError } from '../errors/cli-usage-error';

import { COMMAND_NAMES, DEFAULT_SEED, PRESET_NAMES } from './preset-names';
import { stageForArgument } from './stage-for-argument';

export interface PlanOptions {
  readonly preset: MontagePresetName;
  readonly seed: number;
}

export type ParsedCommand =
  | { readonly command: 'ingest'; readonly projectRoot: string }
  | { readonly command: 'plan'; readonly projectRoot: string; readonly options: PlanOptions }
  | { readonly command: 'render'; readonly projectRoot: string }
  | { readonly command: 'run'; readonly projectRoot: string; readonly options: PlanOptions };

type CommandName = (typeof COMMAND_NAMES)[number];

const SEED_PATTERN = /^\d+$/;
const COMMAND_LIST = COMMAND_NAMES.join(' | ');
const PRESET_LIST = PRESET_NAMES.join(' | ');

function isCommandName(value: string): value is CommandName {
  return (COMMAND_NAMES as readonly string[]).includes(value);
}

function isPresetName(value: string): value is MontagePresetName {
  return (PRESET_NAMES as readonly string[]).includes(value);
}

function parseArgsErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function parseArgsErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function extractQuotedToken(message: string): string | null {
  const match = /'([^']+)'/.exec(message);
  return match === null ? null : (match[1] ?? null);
}

function translateParseArgsError(command: CommandName, error: unknown): CliUsageError {
  const code = parseArgsErrorCode(error);
  const resource = extractQuotedToken(parseArgsErrorMessage(error));
  const stage = stageForArgument(command, 'project-root');

  switch (code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return new CliUsageError({ stage, reason: 'unknown-option', resource });
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return new CliUsageError({ stage, reason: 'invalid-option-value', resource });
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return new CliUsageError({ stage, reason: 'unexpected-positional', resource });
    default:
      throw error;
  }
}

function parseNodeArgs(command: CommandName, rest: readonly string[]) {
  try {
    return parseArgs({
      args: rest,
      options: { preset: { type: 'string' }, seed: { type: 'string' } },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw translateParseArgsError(command, error);
  }
}

function parsePresetAndSeed(command: 'plan' | 'run', rawPreset: string | undefined, rawSeed: string | undefined): PlanOptions {
  if (rawPreset === undefined) {
    throw new CliArgumentError({
      stage: stageForArgument(command, 'preset'),
      reason: 'missing-preset',
      expected: PRESET_LIST,
    });
  }

  if (!isPresetName(rawPreset)) {
    throw new CliArgumentError({
      stage: stageForArgument(command, 'preset'),
      reason: 'unknown-preset',
      resource: `--preset=${rawPreset}`,
      expected: PRESET_LIST,
    });
  }

  if (rawSeed === undefined) {
    return { preset: rawPreset, seed: DEFAULT_SEED };
  }

  if (!SEED_PATTERN.test(rawSeed) || !Number.isSafeInteger(Number(rawSeed))) {
    throw new CliArgumentError({
      stage: stageForArgument(command, 'seed'),
      reason: 'invalid-seed',
      resource: `--seed=${rawSeed}`,
      expected: 'non-negative integer',
    });
  }

  return { preset: rawPreset, seed: Number(rawSeed) };
}

export function parseCliArgs(argv: readonly string[]): ParsedCommand {
  const [rawCommand, ...rest] = argv;
  if (rawCommand === undefined) {
    throw new CliUsageError({ reason: 'missing-command', expected: COMMAND_LIST });
  }
  if (!isCommandName(rawCommand)) {
    throw new CliUsageError({ reason: 'unknown-command', resource: rawCommand, expected: COMMAND_LIST });
  }

  const parsed = parseNodeArgs(rawCommand, rest);

  const [projectRoot, extraPositional] = parsed.positionals;
  if (projectRoot === undefined) {
    throw new CliUsageError({ stage: stageForArgument(rawCommand, 'project-root'), reason: 'missing-project-root' });
  }
  if (extraPositional !== undefined) {
    throw new CliUsageError({
      stage: stageForArgument(rawCommand, 'project-root'),
      reason: 'unexpected-positional',
      resource: extraPositional,
    });
  }

  const { preset: rawPreset, seed: rawSeed } = parsed.values;

  if (rawCommand === 'ingest' || rawCommand === 'render') {
    if (rawPreset !== undefined) {
      throw new CliUsageError({
        stage: stageForArgument(rawCommand, 'preset'),
        reason: 'unexpected-option',
        resource: '--preset',
        expected: `${rawCommand} takes no --preset and no --seed`,
      });
    }
    if (rawSeed !== undefined) {
      throw new CliUsageError({
        stage: stageForArgument(rawCommand, 'seed'),
        reason: 'unexpected-option',
        resource: '--seed',
        expected: `${rawCommand} takes no --preset and no --seed`,
      });
    }
    return { command: rawCommand, projectRoot };
  }

  const options = parsePresetAndSeed(rawCommand, rawPreset, rawSeed);
  return { command: rawCommand, projectRoot, options };
}
