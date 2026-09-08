import { describe, expect, it } from 'vitest';

import { stageForArgument } from './stage-for-argument';
import type { CliArgument } from './stage-for-argument';
import type { ParsedCommand } from './parse-cli-args';

describe('stageForArgument', () => {
  it.each([
    ['ingest', 'project-root', 'ingest'],
    ['ingest', 'preset', 'ingest'],
    ['ingest', 'seed', 'ingest'],
    ['plan', 'project-root', 'plan'],
    ['plan', 'preset', 'plan'],
    ['plan', 'seed', 'plan'],
    ['render', 'project-root', 'render'],
    ['render', 'preset', 'render'],
    ['render', 'seed', 'render'],
    ['run', 'project-root', 'ingest'],
    ['run', 'preset', 'plan'],
    ['run', 'seed', 'plan'],
  ] as const satisfies readonly (readonly [ParsedCommand['command'], CliArgument, string])[])(
    '%s + %s -> %s',
    (command, argument, expectedStage) => {
      expect(stageForArgument(command, argument)).toBe(expectedStage);
    },
  );
});
