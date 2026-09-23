import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const electronBin = resolve(repoRoot, 'node_modules', '.bin', 'electron');
const mainEntry = resolve(repoRoot, 'dist', 'out-tsc', 'apps', 'desktop', 'src', 'main', 'main.js');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, [mainEntry], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
