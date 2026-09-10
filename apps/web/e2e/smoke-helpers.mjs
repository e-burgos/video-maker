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

export const VOICE_ENV_VARS = [...MEDIA_ENV_VARS, 'PIPER_PATH', 'PIPER_MODEL_PATH'];

export const MIN_FREE_MEMORY_RATIO = 0.35;

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

export function assertMediaEnvResolvable(names = MEDIA_ENV_VARS) {
  const missing = names.filter((name) => (process.env[name] ?? '') === '');
  assert(
    missing.length === 0,
    `the ${names.length} media env vars are present in the environment (missing: ${missing.join(', ') || 'none'})`,
  );
}

export function freeMemoryRatio() {
  const report = execSync('memory_pressure', { encoding: 'utf8' });
  const percentage = /System-wide memory free percentage:\s*(\d+)%/.exec(report)?.[1];
  if (percentage === undefined) {
    throw new Error('memory_pressure did not report a system-wide free percentage');
  }
  return Number(percentage) / 100;
}

export async function memoryGate() {
  log('0', 'memory gate');
  let heavyProcesses = '';
  try {
    heavyProcesses = execSync("pgrep -fl 'ffmpeg|whisper-cli|piper|chrome-headless' || true", {
      encoding: 'utf8',
    }).trim();
  } catch {
    heavyProcesses = '';
  }
  assert(
    heavyProcesses === '',
    `no ffmpeg/whisper-cli/piper/chrome-headless process alive (found: ${heavyProcesses || 'none'})`,
  );

  try {
    const ratio = freeMemoryRatio();
    log('0', `free memory ratio: ${(ratio * 100).toFixed(1)}%`);
    assert(
      ratio >= MIN_FREE_MEMORY_RATIO,
      `at least ${MIN_FREE_MEMORY_RATIO * 100}% of the memory is free (measured ${(ratio * 100).toFixed(1)}%)`,
    );
  } catch (cause) {
    if (String(cause).startsWith('Error: ASSERTION FAILED')) {
      throw cause;
    }
    log('0', 'vm_stat not available on this platform, continuing without the memory gate');
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
