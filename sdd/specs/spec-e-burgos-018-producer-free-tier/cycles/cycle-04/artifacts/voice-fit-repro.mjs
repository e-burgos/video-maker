import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..', '..');
const REPORT_PATH = join(HERE, 'voice-fit-repro.md');

const SOURCE_PROJECT_SLUG = 'display-ads-editar-campana';
const HTTP_HOST = '127.0.0.1';
const HTTP_PORT = 4621;
const SERVER_READY_TIMEOUT_MS = 20_000;
const JOB_TIMEOUT_MS = 120_000;
const CUTOFF_HOUR_UTC = 23;
const CUTOFF_MINUTE_UTC = 40;

const VOICE_ID = 'es_AR-daniela-high';
const SCRIPT_PATH = 'work/producer/script.txt';
const GAP_MS = 900;
const EXPECTED_TIGHT_LINE = 'line-07';

const TOOLCHAIN_ENV_NAMES = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
  'TTS_CLI_PATH',
  'TTS_VOICES_DIR',
];

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

function pastCutoff() {
  const now = new Date();
  return (
    now.getUTCHours() > CUTOFF_HOUR_UTC ||
    (now.getUTCHours() === CUTOFF_HOUR_UTC && now.getUTCMinutes() >= CUTOFF_MINUTE_UTC)
  );
}

async function loadToolchainEnv() {
  const raw = await readFile(join(REPO_ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match === null) {
      continue;
    }
    const [, name, value] = match;
    if (!TOOLCHAIN_ENV_NAMES.includes(name)) {
      continue;
    }
    env[name] = value.replace(/^['"]|['"]$/g, '');
  }
  for (const name of TOOLCHAIN_ENV_NAMES) {
    if (env[name] === undefined) {
      throw new Error(`missing ${name} in the repo root .env`);
    }
  }
  return env;
}

async function cloneProject(destRoot) {
  const source = join(REPO_ROOT, 'media', SOURCE_PROJECT_SLUG);
  const dest = join(destRoot, SOURCE_PROJECT_SLUG);
  execFileSync('cp', ['-Rc', source, dest]);
  return dest;
}

function spawnRenderApi(port, mediaRoot, dbPath, toolchainEnv) {
  const child = spawn(
    process.execPath,
    ['-r', join(REPO_ROOT, 'apps/render-api/src/server-register.cjs'), join(REPO_ROOT, 'apps/render-api/src/main.ts')],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ...toolchainEnv,
        RENDER_API_PORT: String(port),
        RENDER_API_HOST: HTTP_HOST,
        RENDER_API_MEDIA_ROOT: mediaRoot,
        RENDER_API_DB_PATH: dbPath,
        SWC_NODE_PROJECT: join(REPO_ROOT, 'tsconfig.base.json'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stderrTail = '';
  child.stderr.on('data', (chunk) => {
    stderrTail = `${stderrTail}${chunk}`.slice(-4000);
  });
  child.stderrTail = () => stderrTail;
  return child;
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopRenderApi(child) {
  if (child === undefined || child === null) {
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  if (await waitForExit(child, 3000)) {
    return;
  }
  child.kill('SIGKILL');
  if (!(await waitForExit(child, 3000))) {
    log('repro', `render-api pid ${child.pid} did not exit after SIGKILL`);
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function startVoiceJob(apiUrl, slug) {
  const response = await fetch(`${apiUrl}/projects/${slug}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'voice', voiceId: VOICE_ID, scriptPath: SCRIPT_PATH, gapMs: GAP_MS }),
  });
  if (!response.ok) {
    throw new Error(`POST jobs failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function waitForTerminalJob(apiUrl, jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const response = await fetch(`${apiUrl}/jobs/${jobId}`);
    last = await response.json();
    if (['succeeded', 'failed', 'canceled'].includes(last.state)) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`voice job ${jobId} did not reach a terminal state within ${timeoutMs}ms: ${JSON.stringify(last)}`);
}

function renderReport({ job, mediaRoot }) {
  const succeeded = job.state === 'succeeded';
  const lines = [
    '# voice-fit-repro — the resynthesis path for a line that needs to speed up',
    '',
    `Date: ${new Date().toISOString()}`,
    `Project: ${SOURCE_PROJECT_SLUG} (temp clone, discarded after the run)`,
    `Script: ${SCRIPT_PATH}, voice ${VOICE_ID}, gapMs ${GAP_MS}`,
    '',
    '## What this reproduces',
    '',
    'Three real productions from the app (display-ads-editar-campana, display-ads-solapamiento-campanas,',
    'display-ads-linea-de-tiempo, all under media/) failed 3/3 on their voice job with',
    '`VOICE_SYNTHESIS_FAILED` at the `synthesize` stage. In every case the failing `resource` was the one',
    'line whose window before the next `[m:ss]` mark (or, for linea-de-tiempo, before the next line) is',
    'too tight for its natural speech duration, so `planVoiceScriptPlacements` schedules a resynthesis at a',
    'slower `lengthScale` (clipped at `VOICE_SCRIPT_MIN_LENGTH_SCALE = 0.85`).',
    '',
    '## Root cause (confirmed by instrumenting translateVoiceError and re-running the exact job)',
    '',
    '`libs/media-local/src/tts/synthesize-speech.ts` passed `--vits-length-scale` and its value as two',
    'separate argv entries (`[\'--vits-length-scale\', String(opts.lengthScale)]`), the only flag in that',
    'function not using the `--flag=value` form every other sherpa-onnx-offline-tts flag already uses.',
    "sherpa-onnx-offline-tts's option parser (kaldi-style `parse-options.cc`) only accepts `--flag=value`",
    'for its options; given two separate tokens it silently reads an empty string as the value and exits',
    '255 with `Invalid floating-point option ""`. That real `CommandFailedError` was then swallowed by',
    '`translateVoiceError`, which maps every failure of the `synthesize` stage to the generic',
    '`VOICE_SYNTHESIS_FAILED` — hiding the argument bug behind a message that reads like a content problem.',
    '',
    'This is deterministic: the FIRST synthesis pass never sets `lengthScale` (natural speed), so every',
    "line's initial .wav always succeeds — that is why every project's `work/voice/sources/` already had",
    'every line. The bug only fires on the SECOND pass, `fitTimedLinesIntoTheirWindows`, and only for the',
    'one line that actually needs to shrink — matching "failed 3/3, same resource every time" exactly.',
    '',
    '## Why the fix is "make it work", not a new error code',
    '',
    'The pipeline already treats an unavoidable overflow as data, not failure: `planVoiceScriptPlacements`',
    'reports `overflowMs` per line instead of throwing, `fitTimedLinesIntoTheirWindows` already falls back',
    'to `VOICE_SCRIPT_MIN_LENGTH_SCALE` instead of refusing an extreme compression, and the constitution',
    'documents the same "report the delta, do not fail" contract elsewhere (`withinTolerance: false` is',
    'not a failure, D-7). A line that cannot fully fit even at 0.85 should still synthesize at 0.85 and',
    'report the leftover via `overflowMs` — which is exactly what happens once the CLI call itself stops',
    'failing. No new error code was needed.',
    '',
    '## The fix',
    '',
    '```diff',
    '- opts.lengthScale === undefined || opts.lengthScale === 1',
    '-   ? []',
    "-   : ['--vits-length-scale', String(opts.lengthScale)];",
    '+ opts.lengthScale === undefined || opts.lengthScale === 1',
    '+   ? []',
    '+   : [`--vits-length-scale=${opts.lengthScale}`];',
    '```',
    '',
    '## Before / after (this exact script, only that one line changed in between)',
    '',
    '### Before the fix — swallowed error',
    '',
    '```',
    'job.state:  "failed"',
    'job.error:  {"code":"VOICE_SYNTHESIS_FAILED","stage":"synthesize","message":"The speech synthesizer ' +
      'failed while producing a scene track.","resource":"line-07"}',
    '',
    '# with translateVoiceError instrumented to log its `cause` before mapping it:',
    'CommandFailedError: ... sherpa-onnx-offline-tts --vits-model=... --vits-length-scale 0.85 ' +
      '--output-filename=.../line-07.wav "La tarjeta vuelve a mostrar el horario de siempre." terminó con código 255.',
    '  stderr: "/…/parse-options.cc:ToFloat:622 Invalid floating-point option \\"\\"\\n"',
    '```',
    '',
    '### After the fix — this run',
    '',
    '```',
    `job.state:  "${job.state}"`,
    `job.error:  ${JSON.stringify(job.error)}`,
    `manifest lines: ${job.report?.track?.lineCount ?? 'n/a'}`,
    '```',
    '',
    `Media root of this run (discarded on exit): \`${mediaRoot}\``,
    '',
    `- Voice job over a script whose tight line (\`${EXPECTED_TIGHT_LINE}\`) needs the resynthesis path: **${succeeded ? 'PASSED' : 'FAILED'}**`,
  ];
  return lines.join('\n');
}

async function main() {
  if (pastCutoff()) {
    log('repro', `it is already past ${CUTOFF_HOUR_UTC}:${CUTOFF_MINUTE_UTC} UTC — pausing before starting any heavy work`);
    return;
  }

  const toolchainEnv = await loadToolchainEnv();
  const mediaRootBase = await mkdtemp(join(tmpdir(), 'vm-voice-fit-repro-'));
  const dbPath = join(mediaRootBase, '.studio', 'studio.db');
  const apiUrl = `http://${HTTP_HOST}:${HTTP_PORT}`;

  let child;
  try {
    await cloneProject(mediaRootBase);

    child = spawnRenderApi(HTTP_PORT, mediaRootBase, dbPath, toolchainEnv);
    await waitForHttp(`${apiUrl}/health`, SERVER_READY_TIMEOUT_MS);
    log('repro', `render-api ready on port ${HTTP_PORT}, media root ${mediaRootBase}`);

    const created = await startVoiceJob(apiUrl, SOURCE_PROJECT_SLUG);
    log('repro', `voice job ${created.id} started, waiting for it to finish...`);
    const job = await waitForTerminalJob(apiUrl, created.id, JOB_TIMEOUT_MS);
    log('repro', `voice job finished: ${job.state}`);

    const report = renderReport({ job, mediaRoot: mediaRootBase });
    await writeFile(REPORT_PATH, report, 'utf8');
    log('repro', `report written to ${REPORT_PATH}`);

    if (job.state !== 'succeeded') {
      throw new Error(`voice job did not succeed: ${JSON.stringify(job.error)}`);
    }
    log('repro', 'PASSED: the tight line resynthesized and the voice job succeeded');
  } finally {
    await stopRenderApi(child);
    await rm(mediaRootBase, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[repro] FAILED: ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
