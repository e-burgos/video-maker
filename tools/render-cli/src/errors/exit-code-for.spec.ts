import { describe, expect, it } from 'vitest';

import { CliArgumentError } from './cli-argument-error';
import { CliUsageError } from './cli-usage-error';
import { exitCodeFor } from './exit-code-for';
import { StageFailedError } from './stage-failed-error';
import { StageInputMissingError } from './stage-input-missing-error';

describe('exitCodeFor', () => {
  it.each([
    ['missing-command', new CliUsageError({ reason: 'missing-command' }), 2],
    ['unknown-command', new CliUsageError({ reason: 'unknown-command', resource: 'rnder' }), 2],
    ['missing-project-root', new CliUsageError({ reason: 'missing-project-root' }), 2],
    ['unexpected-positional', new CliUsageError({ reason: 'unexpected-positional' }), 2],
    ['unexpected-option', new CliUsageError({ reason: 'unexpected-option', resource: '--preset' }), 2],
    ['unknown-option', new CliUsageError({ reason: 'unknown-option', resource: '--bogus' }), 2],
    ['missing-preset', new CliArgumentError({ stage: 'plan', reason: 'missing-preset' }), 2],
    ['unknown-preset', new CliArgumentError({ stage: 'plan', reason: 'unknown-preset' }), 2],
    ['invalid-seed', new CliArgumentError({ stage: 'plan', reason: 'invalid-seed' }), 2],
    [
      'project-root-not-found',
      new StageInputMissingError({ stage: 'ingest', resource: '/media/p', reason: 'project-root-not-found' }),
      3,
    ],
    [
      'raw-missing',
      new StageInputMissingError({ stage: 'ingest', resource: 'raw', reason: 'raw-missing' }),
      3,
    ],
    [
      'raw-has-no-role-directory',
      new StageInputMissingError({ stage: 'ingest', resource: 'raw', reason: 'raw-has-no-role-directory' }),
      3,
    ],
    [
      'catalog-missing',
      new StageInputMissingError({ stage: 'plan', resource: 'work/catalog.json', reason: 'catalog-missing' }),
      3,
    ],
    [
      'timeline-missing',
      new StageInputMissingError({ stage: 'render', resource: 'work/timeline.json', reason: 'timeline-missing' }),
      3,
    ],
    [
      'ingest BINARY_NOT_FOUND',
      new StageFailedError({ stage: 'ingest', resource: 'whisper-cli', reason: 'BINARY_NOT_FOUND', cause: new Error('boom') }),
      4,
    ],
    [
      'ingest PROJECT_LAYOUT_INVALID',
      new StageFailedError({ stage: 'ingest', resource: 'raw', reason: 'PROJECT_LAYOUT_INVALID', cause: new Error('boom') }),
      4,
    ],
    [
      'plan MONTAGE_INPUT_INVALID',
      new StageFailedError({ stage: 'plan', resource: 'work/catalog.json', reason: 'MONTAGE_INPUT_INVALID', cause: new Error('boom') }),
      5,
    ],
    [
      'render TIMELINE_UNREADABLE',
      new StageFailedError({ stage: 'render', resource: 'work/timeline.json', reason: 'TIMELINE_UNREADABLE', cause: new Error('boom') }),
      6,
    ],
    [
      'render BUNDLE_FAILED',
      new StageFailedError({ stage: 'render', resource: 'out/smoke-ingest.mp4', reason: 'BUNDLE_FAILED', cause: new Error('boom') }),
      6,
    ],
  ] as const)('%s -> exit %i', (_description, error, expectedExitCode) => {
    expect(exitCodeFor(error)).toBe(expectedExitCode);
  });

  it('returns 1 for an untyped error that escaped from a lib', () => {
    expect(exitCodeFor(new TypeError('boom'))).toBe(1);
  });

  it('returns 1 for a non-error, non-RenderCliError value', () => {
    expect(exitCodeFor('not-an-error')).toBe(1);
  });
});
