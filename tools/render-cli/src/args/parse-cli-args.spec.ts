import { describe, expect, it } from 'vitest';

import { CliArgumentError } from '../errors/cli-argument-error';
import { CliUsageError } from '../errors/cli-usage-error';

import { parseCliArgs } from './parse-cli-args';

function captureThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}

describe('parseCliArgs — success paths', () => {
  it('parses ingest with only the project root', () => {
    expect(parseCliArgs(['ingest', 'media/p'])).toEqual({ command: 'ingest', projectRoot: 'media/p' });
  });

  it('parses render with only the project root', () => {
    expect(parseCliArgs(['render', 'media/p'])).toEqual({ command: 'render', projectRoot: 'media/p' });
  });

  it('parses plan with a preset and defaults the seed to 0', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'hardware'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'hardware', seed: 0 },
    });
  });

  it('parses plan with an explicit seed', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'recipe', '--seed', '42'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'recipe', seed: 42 },
    });
  });

  it('parses run with a preset and an explicit seed', () => {
    expect(parseCliArgs(['run', 'media/p', '--preset', 'educational', '--seed', '3'])).toEqual({
      command: 'run',
      projectRoot: 'media/p',
      options: { preset: 'educational', seed: 3 },
    });
  });
});

describe('parseCliArgs — the 8-step validation order of §4.1', () => {
  it('step 1: no tokens at all -> missing-command, stage null', () => {
    const error = captureThrown(() => parseCliArgs([]));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('missing-command');
    expect((error as CliUsageError).stage).toBeNull();
  });

  it('step 2: unknown command -> unknown-command, carrying the offending token', () => {
    const error = captureThrown(() => parseCliArgs(['rnder', 'media/p']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unknown-command');
    expect((error as CliUsageError).resource).toBe('rnder');
  });

  it('step 3: an unknown option surfaces node:util parseArgs ERR_PARSE_ARGS_UNKNOWN_OPTION as unknown-option', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', '--bogus']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unknown-option');
  });

  it('step 3: a string option without a value surfaces ERR_PARSE_ARGS_INVALID_OPTION_VALUE', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('invalid-option-value');
  });

  it('step 4: missing the project root positional -> missing-project-root', () => {
    const error = captureThrown(() => parseCliArgs(['ingest']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('missing-project-root');
  });

  it('step 4: an extra positional -> unexpected-positional, before the preset/seed checks', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', 'extra']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-positional');
    expect((error as CliUsageError).resource).toBe('extra');
  });

  it('step 4 wins over step 5: an extra positional beats an unexpected --preset on ingest', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', 'extra', '--preset', 'hardware']));
    expect((error as CliUsageError).reason).toBe('unexpected-positional');
  });

  it('step 5: --preset on ingest is unexpected-option, not a CliArgumentError', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', '--preset', 'hardware']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-option');
    expect((error as CliUsageError).resource).toBe('--preset');
  });

  it('step 5: --seed on render is unexpected-option, not a CliArgumentError', () => {
    const error = captureThrown(() => parseCliArgs(['render', 'media/p', '--seed', '3']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-option');
    expect((error as CliUsageError).resource).toBe('--seed');
  });

  it('step 6: missing --preset on plan -> CliArgumentError with stage plan', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('missing-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 6 wins over step 8: missing --preset on plan beats an invalid --seed', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--seed', 'nope']));
    expect((error as CliArgumentError).reason).toBe('missing-preset');
  });

  it('step 6: missing --preset on run maps to stage plan (D-27)', () => {
    const error = captureThrown(() => parseCliArgs(['run', 'media/p']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('missing-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 7: an unknown --preset value -> unknown-preset with stage plan', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'bogus']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('unknown-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
    expect((error as CliArgumentError).resource).toBe('--preset=bogus');
  });

  it('step 7 wins over step 8: an unknown preset beats an invalid seed', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'bogus', '--seed', 'nope']));
    expect((error as CliArgumentError).reason).toBe('unknown-preset');
  });

  it.each(['', ' 1 ', '0x10', '1e3', '-1', '3.5'])('step 8: %j is an invalid seed', (rawSeed) => {
    // `--seed=<value>` avoids node:util parseArgs flagging a leading '-' as another option.
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'hardware', `--seed=${rawSeed}`]));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('invalid-seed');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 3: --seed -1 (space-separated) is ambiguous to node:util parseArgs and surfaces as CliUsageError', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'hardware', '--seed', '-1']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('invalid-option-value');
  });

  it('step 8: seed 0 is valid', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'hardware', '--seed', '0'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'hardware', seed: 0 },
    });
  });
});
