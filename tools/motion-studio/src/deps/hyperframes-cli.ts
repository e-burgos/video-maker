import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { HYPERFRAMES_VERSION, MotionStudioError, hyperframesInvocation } from '@video-maker/motion-graphics';
import type { HyperframesInvocation } from '@video-maker/motion-graphics';

const CLI_ENTRY = 'hyperframes/dist/cli.js';

export function resolveHyperframesCli(env: NodeJS.ProcessEnv = process.env, resolveFrom: string = process.cwd()): HyperframesInvocation {
  const cliPath = createRequire(join(resolveFrom, 'package.json')).resolve(CLI_ENTRY);
  assertInstalledVersion(cliPath);
  return hyperframesInvocation({ cliPath, execPath: process.execPath, isElectron: process.versions['electron'] !== undefined, env });
}

function assertInstalledVersion(cliPath: string): void {
  const manifest = JSON.parse(readFileSync(join(dirname(cliPath), '..', 'package.json'), 'utf8')) as { version?: string };
  if (manifest.version !== HYPERFRAMES_VERSION) {
    throw new MotionStudioError('STAGE_FAILED', `hyperframes ${HYPERFRAMES_VERSION} expected, found ${manifest.version ?? 'unknown'} at ${cliPath}`);
  }
}
