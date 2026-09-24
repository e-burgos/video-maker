import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadWorkspaceAliases() {
  const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf8'));
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const alias = {};
  for (const [specifier, targets] of Object.entries(paths)) {
    const [target] = targets;
    if (target !== undefined) {
      alias[specifier] = join(repoRoot, target);
    }
  }
  return alias;
}

function parseArgs(argv) {
  const positional = [];
  const external = [];
  for (const arg of argv) {
    if (arg.startsWith('--external:')) {
      external.push(arg.slice('--external:'.length));
    } else {
      positional.push(arg);
    }
  }
  const [entryPoint, outfile] = positional;
  if (entryPoint === undefined || outfile === undefined) {
    throw new Error('usage: esbuild-node-bundle.mjs <entryPoint> <outfile> [--external:pkg ...]');
  }
  return { entryPoint, outfile, external };
}

async function main() {
  const { entryPoint, outfile, external } = parseArgs(process.argv.slice(2));

  await build({
    entryPoints: [join(repoRoot, entryPoint)],
    outfile: join(repoRoot, outfile),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    logLevel: 'info',
    alias: loadWorkspaceAliases(),
    external,
    define: { 'import.meta.url': '__filename' },
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
