import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function readDotEnvValue(key) {
  const filePath = resolve(repoRoot, '.env');
  if (!existsSync(filePath)) return undefined;
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    const separator = line.indexOf('=');
    if (line.startsWith('#') || separator <= 0 || line.slice(0, separator).trim() !== key) continue;
    return line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

function resolvePort(key, fallback) {
  return process.env[key] ?? readDotEnvValue(key) ?? fallback;
}

function pidsListeningOn(port) {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return output.split('\n').filter((pid) => pid.trim() !== '');
  } catch {
    return [];
  }
}

const targets = [
  { name: 'render-api', port: resolvePort('RENDER_API_PORT', '4399') },
  { name: 'web', port: resolvePort('WEB_PORT', '4207') },
];

for (const { name, port } of targets) {
  const pids = pidsListeningOn(port);
  if (pids.length === 0) {
    process.stdout.write(`[studio] ${name}: nothing listening on :${port}\n`);
    continue;
  }
  for (const pid of pids) {
    process.kill(Number(pid), 'SIGTERM');
  }
  process.stdout.write(`[studio] ${name}: stopped pid ${pids.join(', ')} on :${port}\n`);
}
