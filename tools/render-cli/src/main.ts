import { resolve } from 'node:path';

import { runCli } from './cli';
import { createNodeCliDependencies } from './deps/node-cli-dependencies';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const resolveProjectRoot = (raw: string): string => resolve(process.cwd(), raw);
  const deps = createNodeCliDependencies(process.env);

  const outcome = await runCli(argv, resolveProjectRoot, deps);

  outcome.stdout.forEach((line) => process.stdout.write(`${line}\n`));
  outcome.stderr.forEach((line) => process.stderr.write(`${line}\n`));
  process.exitCode = outcome.exitCode;
}

void main();
