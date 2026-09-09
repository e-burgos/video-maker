import { describe, expect, it, vi } from 'vitest';

import { CliArgumentError } from './cli-argument-error';
import { CliUsageError } from './cli-usage-error';
import { formatCliError } from './format-cli-error';
import { RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';
import { StageFailedError } from './stage-failed-error';
import { StageInputMissingError } from './stage-input-missing-error';

class FullRenderCliError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'CLI_ARGUMENT';
  readonly stage: Stage | null = 'render';
  readonly resource: string | null = 'work/timeline.json';
  readonly reason = 'demo-reason';
  readonly expected: string | null = 'demo-expected';
  readonly hint: string | null = 'demo-hint';

  constructor() {
    super('demo-reason', { cause: new Error('demo-cause') });
    this.name = 'FullRenderCliError';
  }
}

describe('formatCliError', () => {
  it('formats an unknown-command CliUsageError', () => {
    const error = new CliUsageError({
      reason: 'unknown-command',
      resource: 'rnder',
      expected: 'ingest | plan | render | run',
    });

    expect(formatCliError(error)).toEqual([
      'error [usage] unknown-command',
      '  resource: rnder',
      '  expected: ingest | plan | render | run',
    ]);
  });

  it('formats an unexpected-option CliUsageError', () => {
    const error = new CliUsageError({
      reason: 'unexpected-option',
      resource: '--preset',
      expected: 'render takes no --preset and no --seed',
    });

    expect(formatCliError(error)).toEqual([
      'error [usage] unexpected-option',
      '  resource: --preset',
      '  expected: render takes no --preset and no --seed',
    ]);
  });

  it('formats an unknown-preset CliArgumentError', () => {
    const error = new CliArgumentError({
      stage: 'plan',
      reason: 'unknown-preset',
      resource: '--preset=fast',
      expected: 'software-demo | hardware | recipe | educational',
    });

    expect(formatCliError(error)).toEqual([
      'error [plan] unknown-preset',
      '  resource: --preset=fast',
      '  expected: software-demo | hardware | recipe | educational',
    ]);
  });

  it('formats an invalid-seed CliArgumentError', () => {
    const error = new CliArgumentError({
      stage: 'plan',
      reason: 'invalid-seed',
      resource: '--seed=-1',
      expected: 'non-negative integer',
    });

    expect(formatCliError(error)).toEqual([
      'error [plan] invalid-seed',
      '  resource: --seed=-1',
      '  expected: non-negative integer',
    ]);
  });

  it('formats a catalog-missing StageInputMissingError', () => {
    const error = new StageInputMissingError({
      stage: 'plan',
      resource: 'work/catalog.json',
      reason: 'catalog-missing',
      hint: 'run `ingest` before `plan`',
    });

    expect(formatCliError(error)).toEqual([
      'error [plan] catalog-missing',
      '  resource: work/catalog.json',
      '  hint: run `ingest` before `plan`',
    ]);
  });

  it('formats a timeline-missing StageInputMissingError', () => {
    const error = new StageInputMissingError({
      stage: 'render',
      resource: 'work/timeline.json',
      reason: 'timeline-missing',
      hint: 'run `plan` before `render`',
    });

    expect(formatCliError(error)).toEqual([
      'error [render] timeline-missing',
      '  resource: work/timeline.json',
      '  hint: run `plan` before `render`',
    ]);
  });

  it('formats an ingest BINARY_NOT_FOUND StageFailedError', () => {
    const cause = new Error('No se encontró el binario "whisper-cli".');
    const error = new StageFailedError({
      stage: 'ingest',
      resource: 'whisper-cli',
      reason: 'BINARY_NOT_FOUND',
      cause,
    });

    expect(formatCliError(error)).toEqual([
      'error [ingest] BINARY_NOT_FOUND',
      '  resource: whisper-cli',
      '  cause: No se encontró el binario "whisper-cli".',
    ]);
  });

  it('formats a render BUNDLE_FAILED StageFailedError', () => {
    const cause = new Error('Remotion no pudo bundlear el entry point.');
    const error = new StageFailedError({
      stage: 'render',
      resource: 'out/smoke-ingest.mp4',
      reason: 'BUNDLE_FAILED',
      cause,
    });

    expect(formatCliError(error)).toEqual([
      'error [render] BUNDLE_FAILED',
      '  resource: out/smoke-ingest.mp4',
      '  cause: Remotion no pudo bundlear el entry point.',
    ]);
  });

  it('formats an untyped error as [internal] with its name and message', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'assets')");

    expect(formatCliError(error)).toEqual([
      "error [internal] TypeError: Cannot read properties of undefined (reading 'assets')",
    ]);
  });

  it('formats an untyped error carrying a cause', () => {
    const error = new Error('outer', { cause: new Error('inner reason') });

    expect(formatCliError(error)).toEqual(['error [internal] Error: outer', '  cause: inner reason']);
  });

  it('formats a non-Error thrown value', () => {
    expect(formatCliError('just-a-string')).toEqual(['error [internal] Error: just-a-string']);
  });

  it('uses English labels for all six data tags: usage, internal, resource, expected, cause, hint', () => {
    expect(formatCliError(new FullRenderCliError())).toEqual([
      'error [render] demo-reason',
      '  resource: work/timeline.json',
      '  expected: demo-expected',
      '  cause: demo-cause',
      '  hint: demo-hint',
    ]);
    expect(formatCliError(new CliUsageError({ reason: 'missing-command' }))[0]).toBe('error [usage] missing-command');
    expect(formatCliError(new TypeError('boom'))[0]).toBe('error [internal] TypeError: boom');
  });

  it('never accesses .stack', () => {
    const error = new CliUsageError({ reason: 'missing-command' });
    const stackSpy = vi.spyOn(error, 'stack', 'get');

    formatCliError(error);

    expect(stackSpy).not.toHaveBeenCalled();
  });
});
