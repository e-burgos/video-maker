import { parseArgs } from 'node:util';
import type { LogoMode, MontagePresetName } from '@video-maker/auto-montage';

import { CliArgumentError } from '../errors/cli-argument-error';
import { CliUsageError } from '../errors/cli-usage-error';

import { COMMAND_NAMES, DEFAULT_SEED, PRESET_NAMES } from './preset-names';
import { stageForArgument } from './stage-for-argument';

export interface PlanOptions {
  readonly preset: MontagePresetName;
  readonly seed: number;
  readonly scriptPath: string | null;
  readonly logo: LogoMode;
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
      options: {
        preset: { type: 'string' },
        seed: { type: 'string' },
        script: { type: 'string' },
        'no-logo': { type: 'boolean' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw translateParseArgsError(command, error);
  }
}

interface RawPlanValues {
  readonly preset: string | undefined;
  readonly seed: string | undefined;
  readonly script: string | undefined;
  readonly noLogo: boolean | undefined;
}

function parseScriptPath(command: 'plan' | 'run', rawScript: string | undefined): string | null {
  if (rawScript === undefined) {
    return null;
  }

  if (rawScript.trim().length === 0) {
    throw new CliArgumentError({
      stage: stageForArgument(command, 'script'),
      reason: 'invalid-script',
      resource: '--script=',
      expected: 'a readable path to the script the voice reads',
    });
  }

  return rawScript;
}

function parsePresetAndSeed(command: 'plan' | 'run', values: RawPlanValues): PlanOptions {
  const rawPreset = values.preset;
  const rawSeed = values.seed;
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

  const scriptPath = parseScriptPath(command, values.script);
  const logo: LogoMode = values.noLogo === true ? 'off' : 'auto';

  if (rawSeed === undefined) {
    return { preset: rawPreset, seed: DEFAULT_SEED, scriptPath, logo };
  }

  if (!SEED_PATTERN.test(rawSeed) || !Number.isSafeInteger(Number(rawSeed))) {
    throw new CliArgumentError({
      stage: stageForArgument(command, 'seed'),
      reason: 'invalid-seed',
      resource: `--seed=${rawSeed}`,
      expected: 'non-negative integer',
    });
  }

  return { preset: rawPreset, seed: Number(rawSeed), scriptPath, logo };
}

const PLAN_ONLY_OPTIONS = ['preset', 'seed', 'script', 'no-logo'] as const;

function assertNoPlanOptions(command: 'ingest' | 'render', values: RawPlanValues): void {
  const present: readonly [(typeof PLAN_ONLY_OPTIONS)[number], unknown][] = [
    ['preset', values.preset],
    ['seed', values.seed],
    ['script', values.script],
    ['no-logo', values.noLogo],
  ];

  for (const [name, value] of present) {
    if (value !== undefined) {
      throw new CliUsageError({
        stage: stageForArgument(command, name === 'no-logo' ? 'logo' : name),
        reason: 'unexpected-option',
        resource: `--${name}`,
        expected: `${command} takes none of ${PLAN_ONLY_OPTIONS.map((option) => `--${option}`).join(', ')}`,
      });
    }
  }
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

  const {
    preset: rawPreset,
    seed: rawSeed,
    script: rawScript,
    'no-logo': rawNoLogo,
  } = parsed.values;

  if (rawCommand === 'ingest' || rawCommand === 'render') {
    assertNoPlanOptions(rawCommand, { preset: rawPreset, seed: rawSeed, script: rawScript, noLogo: rawNoLogo });
    return { command: rawCommand, projectRoot };
  }

  const options = parsePresetAndSeed(rawCommand, {
    preset: rawPreset,
    seed: rawSeed,
    script: rawScript,
    noLogo: rawNoLogo,
  });
  return { command: rawCommand, projectRoot, options };
}
