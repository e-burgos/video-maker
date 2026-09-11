import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const only = process.argv[2] ?? 'all';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const entries = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    entries[key] = value;
  }
  return entries;
}

const dotEnv = loadDotEnv(resolve(repoRoot, '.env'));
const apiPort = process.env.RENDER_API_PORT ?? dotEnv.RENDER_API_PORT ?? '4399';
const webPort = process.env.WEB_PORT ?? dotEnv.WEB_PORT ?? '4207';
const apiUrl = `http://127.0.0.1:${apiPort}`;

const sharedEnv = {
  ...dotEnv,
  ...process.env,
  RENDER_API_PORT: apiPort,
  RENDER_API_URL: process.env.RENDER_API_URL ?? apiUrl,
  RENDER_API_MEDIA_ROOT: process.env.RENDER_API_MEDIA_ROOT ?? dotEnv.RENDER_API_MEDIA_ROOT ?? 'media',
  SWC_NODE_PROJECT: 'tsconfig.base.json',
  CLAUDE_CLI_MODEL: process.env.CLAUDE_CLI_MODEL ?? dotEnv.CLAUDE_CLI_MODEL ?? 'sonnet',
  PRODUCER_MODEL: process.env.PRODUCER_MODEL ?? dotEnv.PRODUCER_MODEL ?? 'sonnet',
  WEB_PORT: webPort,
};

const children = [];

function start(name, command, args) {
  const child = spawn(command, args, { cwd: repoRoot, env: sharedEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}] `;
  const forward = (stream, target) => {
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim() !== '') target.write(prefix + line + '\n');
      }
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    process.stdout.write(`${prefix}exited (${signal ?? code})\n`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

let stopping = false;
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

if (only === 'all' || only === 'api') {
  start('api', process.execPath, ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts']);
}
if (only === 'all' || only === 'web') {
  start('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts']);
}

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return true;
    } catch {
      await new Promise((done) => setTimeout(done, 1000));
    }
  }
  return false;
}

if (only === 'all') {
  const ready = await waitForApi();
  process.stdout.write(
    ready
      ? `\nVideo Maker Studio ready\n  web  http://localhost:${webPort}/\n  api  ${apiUrl}/health\n  models: producer=${sharedEnv.PRODUCER_MODEL} storyboard=${sharedEnv.CLAUDE_CLI_MODEL}\n  stop with Ctrl+C or: pnpm studio:stop\n\n`
      : `\n[studio] the API did not answer on ${apiUrl}/health within 60 s\n\n`,
  );
}
