import { describe, expect, it, vi } from 'vitest';

import { CliArgumentError } from './cli-argument-error';
import { CliUsageError } from './cli-usage-error';
import { formatCliError } from './format-cli-error';
import { StageFailedError } from './stage-failed-error';
import { StageInputMissingError } from './stage-input-missing-error';

describe('formatCliError', () => {
  it('formats an unknown-command CliUsageError', () => {
    const error = new CliUsageError({
      reason: 'unknown-command',
      resource: 'rnder',
      expected: 'ingest | plan | render | run',
    });

    expect(formatCliError(error)).toEqual([
      'error [uso] unknown-command',
      '  recurso: rnder',
      '  esperado: ingest | plan | render | run',
    ]);
  });

  it('formats an unexpected-option CliUsageError', () => {
    const error = new CliUsageError({
      reason: 'unexpected-option',
      resource: '--preset',
      expected: 'render no recibe --preset ni --seed',
    });

    expect(formatCliError(error)).toEqual([
      'error [uso] unexpected-option',
      '  recurso: --preset',
      '  esperado: render no recibe --preset ni --seed',
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
      '  recurso: --preset=fast',
      '  esperado: software-demo | hardware | recipe | educational',
    ]);
  });

  it('formats an invalid-seed CliArgumentError', () => {
    const error = new CliArgumentError({
      stage: 'plan',
      reason: 'invalid-seed',
      resource: '--seed=-1',
      expected: 'entero no negativo',
    });

    expect(formatCliError(error)).toEqual([
      'error [plan] invalid-seed',
      '  recurso: --seed=-1',
      '  esperado: entero no negativo',
    ]);
  });

  it('formats a catalog-missing StageInputMissingError', () => {
    const error = new StageInputMissingError({
      stage: 'plan',
      resource: 'work/catalog.json',
      reason: 'catalog-missing',
      hint: 'corré `ingest` antes de `plan`',
    });

    expect(formatCliError(error)).toEqual([
      'error [plan] catalog-missing',
      '  recurso: work/catalog.json',
      '  sugerencia: corré `ingest` antes de `plan`',
    ]);
  });

  it('formats a timeline-missing StageInputMissingError', () => {
    const error = new StageInputMissingError({
      stage: 'render',
      resource: 'work/timeline.json',
      reason: 'timeline-missing',
      hint: 'corré `plan` antes de `render`',
    });

    expect(formatCliError(error)).toEqual([
      'error [render] timeline-missing',
      '  recurso: work/timeline.json',
      '  sugerencia: corré `plan` antes de `render`',
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
      '  recurso: whisper-cli',
      '  causa: No se encontró el binario "whisper-cli".',
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
      '  recurso: out/smoke-ingest.mp4',
      '  causa: Remotion no pudo bundlear el entry point.',
    ]);
  });

  it('formats an untyped error as [interno] with its name and message', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'assets')");

    expect(formatCliError(error)).toEqual([
      "error [interno] TypeError: Cannot read properties of undefined (reading 'assets')",
    ]);
  });

  it('formats an untyped error carrying a cause', () => {
    const error = new Error('outer', { cause: new Error('inner reason') });

    expect(formatCliError(error)).toEqual(['error [interno] Error: outer', '  causa: inner reason']);
  });

  it('formats a non-Error thrown value', () => {
    expect(formatCliError('just-a-string')).toEqual(['error [interno] Error: just-a-string']);
  });

  it('never accesses .stack', () => {
    const error = new CliUsageError({ reason: 'missing-command' });
    const stackSpy = vi.spyOn(error, 'stack', 'get');

    formatCliError(error);

    expect(stackSpy).not.toHaveBeenCalled();
  });
});
