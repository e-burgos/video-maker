import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = '/Users/macbookprom2/github/personal-projects/video-maker';
const scratch = process.argv[2];
const port = process.argv[3];

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const entries = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    entries[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return entries;
}

const env = {
  ...loadDotEnv(resolve(repoRoot, '.env')),
  ...process.env,
  RENDER_API_PORT: port,
  RENDER_API_URL: `http://127.0.0.1:${port}`,
  RENDER_API_MEDIA_ROOT: `${scratch}/media`,
  BRANDS_ROOT: `${repoRoot}/brands`,
  SWC_NODE_PROJECT: 'tsconfig.base.json',
};
const log = openSync(`${scratch}/sample-server.log`, 'a');
const child = spawn(process.execPath, ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'], {
  cwd: repoRoot,
  env,
  detached: true,
  stdio: ['ignore', log, log],
});
writeFileSync(`${scratch}/sample-server.pid`, String(child.pid));
child.unref();
