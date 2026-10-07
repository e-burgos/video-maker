import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { HYPERFRAMES_VERSION, MotionStudioError, hyperframesInvocation } from '@video-maker/motion-graphics';
import type { HyperframesInvocation } from '@video-maker/motion-graphics';

export const HYPERFRAMES_RESOLVE_FROM_ENV_VAR = 'HYPERFRAMES_RESOLVE_FROM';

const CLI_ENTRY = 'hyperframes/dist/cli.js';

export interface ResolveHyperframesCliInput {
  readonly env: NodeJS.ProcessEnv;
  readonly execPath: string;
  readonly isElectron: boolean;
  readonly resolveFrom?: string;
}

function assertInstalledVersion(cliPath: string): void {
  const manifest = JSON.parse(readFileSync(join(dirname(cliPath), '..', 'package.json'), 'utf8')) as {
    version?: string;
  };
  if (manifest.version !== HYPERFRAMES_VERSION) {
    throw new MotionStudioError(
      'STAGE_FAILED',
      `hyperframes ${HYPERFRAMES_VERSION} expected, found ${manifest.version ?? 'unknown'} at ${cliPath}`,
    );
  }
}

export function resolveHyperframesCli(input: ResolveHyperframesCliInput): HyperframesInvocation {
  const resolveFrom = input.resolveFrom ?? input.env[HYPERFRAMES_RESOLVE_FROM_ENV_VAR] ?? process.cwd();
  const cliPath = createRequire(join(resolveFrom, 'package.json')).resolve(CLI_ENTRY);
  assertInstalledVersion(cliPath);
  return hyperframesInvocation({
    cliPath,
    execPath: input.execPath,
    isElectron: input.isElectron,
    env: input.env,
  });
}
