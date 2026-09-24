import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const DIST_DESKTOP_ROOT = resolve(DESKTOP_ROOT, '..', '..', 'dist', 'out-tsc', 'apps', 'desktop');

const STATIC_ASSETS = ['src/setup/setup.html'];

for (const relativePath of STATIC_ASSETS) {
  const from = resolve(DESKTOP_ROOT, relativePath);
  const to = resolve(DIST_DESKTOP_ROOT, relativePath);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
