import { resolve } from 'node:path';

import { runCli } from './cli';
import { createNodeMotionDependencies } from './deps/node-motion-dependencies';

async function main(): Promise<void> {
  const outcome = await runCli(process.argv.slice(2), (raw) => resolve(process.cwd(), raw), createNodeMotionDependencies(process.env, process.cwd()));
  outcome.stdout.forEach((line) => process.stdout.write(`${line}\n`));
  outcome.stderr.forEach((line) => process.stderr.write(`${line}\n`));
  process.exitCode = outcome.exitCode;
}

void main();
