import { execSync, spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(HERE, '..', '..', '..');

export const MEDIA_ENV_VARS = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
];

export function log(step, message) {
  console.log(`[${step}] ${message}`);
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  log('assert', `ok — ${message}`);
}

export async function loadRootEnv(names = MEDIA_ENV_VARS) {
  let raw = '';
  try {
    raw = await readFile(join(REPO_ROOT, '.env'), 'utf8');
  } catch {
    log('env', 'no .env at the repo root; relying on the ambient environment');
    return [];
  }

  const filled = [];
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match === null) {
      continue;
    }
    const [, name, value] = match;
    if (!names.includes(name) || process.env[name] !== undefined) {
      continue;
    }
    process.env[name] = value.replace(/^['"]|['"]$/g, '');
    filled.push(name);
  }

  log('env', `filled from the root .env (names only, never values): ${filled.join(', ') || 'none'}`);
  return filled;
}

export function assertMediaEnvResolvable() {
  const missing = MEDIA_ENV_VARS.filter((name) => (process.env[name] ?? '') === '');
  assert(
    missing.length === 0,
    `the four media env vars are present in the environment (missing: ${missing.join(', ') || 'none'})`,
  );
}

export async function memoryGate() {
  log('0', 'memory gate');
  let heavyProcesses = '';
  try {
    heavyProcesses = execSync("pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || true", {
      encoding: 'utf8',
    }).trim();
  } catch {
    heavyProcesses = '';
  }
  assert(
    heavyProcesses === '',
    `no ffmpeg/whisper-cli/chrome-headless process alive (found: ${heavyProcesses || 'none'})`,
  );

  try {
    const pressure = execSync('memory_pressure | tail -2', { encoding: 'utf8' }).trim();
    log('0', pressure);
  } catch {
    log('0', 'memory_pressure not available on this platform, continuing');
  }
}

export async function resolvePlaywright() {
  try {
    return await import('playwright');
  } catch {
    // fall through to the npx cache below — playwright is never a package.json dependency here
  }

  const npxRoot = join(homedir(), '.npm', '_npx');
  let entries = [];
  try {
    entries = await readdir(npxRoot);
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    const candidate = join(npxRoot, entry, 'node_modules', 'playwright', 'index.mjs');
    try {
      return await import(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(
    'playwright not found. Run `npx playwright install` once on this machine (never add it to ' +
      'package.json) so this script can find it under ~/.npm/_npx/*/node_modules/playwright.',
  );
}

export async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

export function spawnLogged(label, command, args, env) {
  const child = spawn(command, args, { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

export function probeStream(mp4Path, selector, entries) {
  const raw = execSync(
    `ffprobe -v error -select_streams ${selector} -show_entries stream=${entries} -of json "${mp4Path}"`,
    { encoding: 'utf8' },
  );
  return JSON.parse(raw).streams[0];
}
