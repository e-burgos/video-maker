import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..', '..');
const REPORT_PATH = join(HERE, 'storyboard-openrouter-smoke.md');

const SOURCE_PROJECT_SLUG = 'display-ads-analiticas';
const MODEL_ID = 'deepseek/deepseek-v4.1-flash';
const SUCCESS_PORT = 4560;
const FAILURE_PORT = 4561;
const HTTP_HOST = '127.0.0.1';
const BUDGET_CAP_USD = 0.1;
const JOB_POLL_TIMEOUT_MS = 120_000;
const JOB_POLL_INTERVAL_MS = 2000;
const SERVER_READY_TIMEOUT_MS = 20_000;
const MAX_STORYBOARD_ATTEMPTS = 5;

const KEYCHAIN_SERVICE_ENV_VAR = 'RENDER_API_KEYCHAIN_SERVICE';
const REAL_KEYCHAIN_SERVICE = 'Video Maker';
const OPENROUTER_ACCOUNT = 'openrouter';
const KEY_LEAK_PATTERN = 'sk-or-';
const FAKE_OPENROUTER_KEY =
  'sk-or-v1-0000000000000000000000000000000000000000000000000000000000000000';

const TOOLCHAIN_ENV_NAMES = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
  'TTS_CLI_PATH',
  'TTS_VOICES_DIR',
];

const BRIEF_TEXT =
  'Un anuncio corto de 3 escenas para una app de analítica de campañas de display ads: el gancho, ' +
  'una demo del dashboard con las métricas clave, y un llamado a la acción para probar la app gratis. ' +
  'IMPORTANTE: las tres escenas deben usar visualSource "upload" (metraje grabado o generado ' +
  'externamente); ninguna escena usa remotion-scene ni asset.';

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

function assertNoKeyLeak(value, where) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text !== undefined && text.includes(KEY_LEAK_PATTERN)) {
    throw new Error(`refusing to continue: found an OpenRouter-looking secret in ${where}`);
  }
}

function readOpenRouterKeyFromKeychain() {
  const raw = execFileSync(
    '/usr/bin/security',
    ['find-generic-password', '-s', REAL_KEYCHAIN_SERVICE, '-a', OPENROUTER_ACCOUNT, '-w'],
    { encoding: 'utf8' },
  );
  const key = raw.trim();
  if (key === '') {
    throw new Error('the OpenRouter key in the macOS keychain is empty');
  }
  return key;
}

function deleteKeychainEntry(service) {
  try {
    execFileSync('/usr/bin/security', ['delete-generic-password', '-s', service, '-a', OPENROUTER_ACCOUNT], {
      stdio: 'ignore',
    });
  } catch {
    // absent entry is fine; nothing to clean up
  }
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

function loadTimelineCoreModule() {
  process.env.SWC_NODE_PROJECT = join(REPO_ROOT, 'tsconfig.base.json');
  const requireFromRepo = createRequire(join(REPO_ROOT, 'package.json'));
  const Module = requireFromRepo('node:module');
  const nodeJsLoader = Module._extensions['.js'];
  requireFromRepo('@swc-node/register');
  Module._extensions['.js'] = nodeJsLoader;
  return requireFromRepo(join(REPO_ROOT, 'libs/timeline-core/src/index.ts'));
}

async function cloneProject(destRoot) {
  const source = join(REPO_ROOT, 'media', SOURCE_PROJECT_SLUG);
  const dest = join(destRoot, SOURCE_PROJECT_SLUG);
  execFileSync('cp', ['-Rc', source, dest]);
  await rm(join(dest, 'work', 'producer'), { recursive: true, force: true });
  await mkdir(join(dest, 'work'), { recursive: true });
  await mkdir(join(dest, 'out'), { recursive: true });
  return dest;
}

function spawnRenderApi(port, mediaRoot, keychainService, toolchainEnv) {
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
        [KEYCHAIN_SERVICE_ENV_VAR]: keychainService,
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
    log('smoke', `render-api pid ${child.pid} did not exit after SIGKILL`);
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

async function putJson(port, path, body) {
  const response = await fetch(`http://${HTTP_HOST}:${port}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, body: json };
}

async function postJson(port, path, body) {
  const response = await fetch(`http://${HTTP_HOST}:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, body: json };
}

async function getJson(port, path) {
  const response = await fetch(`http://${HTTP_HOST}:${port}${path}`);
  const json = await response.json();
  return { status: response.status, body: json };
}

async function pollJobUntilTerminal(port, jobId, timeoutMs, intervalMs) {
  const terminal = new Set(['succeeded', 'failed', 'canceled']);
  const deadline = Date.now() + timeoutMs;
  let job = null;
  while (Date.now() < deadline) {
    const { status, body } = await getJson(port, `/jobs/${encodeURIComponent(jobId)}`);
    if (status === 200) {
      job = body;
      if (terminal.has(job.state)) {
        return job;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return job;
}

async function runSuccessScenario({ toolchainEnv, realKey, timelineCore }) {
  const keychainService = `Video Maker Smoke ${process.pid}-ok`;
  const mediaRoot = await mkdtemp(join(tmpdir(), 'vm-storyboard-smoke-ok-'));
  let child;
  try {
    await cloneProject(mediaRoot);
    child = spawnRenderApi(SUCCESS_PORT, mediaRoot, keychainService, toolchainEnv);
    await waitForHttp(`http://${HTTP_HOST}:${SUCCESS_PORT}/health`, SERVER_READY_TIMEOUT_MS);

    const settingsResult = await putJson(SUCCESS_PORT, '/settings/producer', {
      engine: 'openrouter',
      models: { openrouter: MODEL_ID },
    });
    if (settingsResult.status !== 200) {
      throw new Error(`PUT /settings/producer failed: ${settingsResult.status} ${JSON.stringify(settingsResult.body)}`);
    }

    const keyResult = await putJson(SUCCESS_PORT, '/settings/producer/openrouter-key', {
      apiKey: realKey,
      verify: true,
    });
    if (keyResult.status !== 200) {
      throw new Error(`PUT /settings/producer/openrouter-key failed: ${keyResult.status}`);
    }

    let job = null;
    let attempts = 0;
    while (attempts < MAX_STORYBOARD_ATTEMPTS) {
      attempts += 1;
      const created = await postJson(SUCCESS_PORT, `/projects/${SOURCE_PROJECT_SLUG}/jobs`, {
        kind: 'storyboard',
        brief: BRIEF_TEXT,
      });
      if (created.status !== 202) {
        throw new Error(`POST storyboard job failed: ${created.status} ${JSON.stringify(created.body)}`);
      }

      job = await pollJobUntilTerminal(SUCCESS_PORT, created.body.id, JOB_POLL_TIMEOUT_MS, JOB_POLL_INTERVAL_MS);
      if (job === null) {
        throw new Error('storyboard job did not reach a terminal state before the poll timeout');
      }
      assertNoKeyLeak(job, 'the job record returned by the API');
      if (job.state === 'succeeded') {
        break;
      }
      log('smoke', `attempt ${attempts}/${MAX_STORYBOARD_ATTEMPTS} ended as ${job.state} (${job.error?.code}); retrying if attempts remain`);
    }
    if (job === null || job.state !== 'succeeded') {
      throw new Error(`storyboard job never succeeded after ${attempts} attempts: ${JSON.stringify(job?.error)}`);
    }

    const storyboardAbsPath = join(mediaRoot, SOURCE_PROJECT_SLUG, job.report.storyboardPath);
    const rawStoryboard = await readFile(storyboardAbsPath, 'utf8');
    const parsedStoryboard = timelineCore.StoryboardDocumentSchema.safeParse(JSON.parse(rawStoryboard));
    if (!parsedStoryboard.success) {
      throw new Error(`saved storyboard does not validate against StoryboardDocumentSchema: ${parsedStoryboard.error.message}`);
    }

    const sceneCount = parsedStoryboard.data.scenes.length;
    if (sceneCount <= 0) {
      throw new Error('saved storyboard has zero scenes');
    }
    if (job.report.usage.model !== MODEL_ID) {
      throw new Error(`expected usage.model ${MODEL_ID}, got ${String(job.report.usage.model)}`);
    }
    if (typeof job.report.usage.costUsd !== 'number') {
      throw new Error(`expected usage.costUsd to be a number, got ${typeof job.report.usage.costUsd}`);
    }

    return {
      ok: true,
      attempts,
      jobState: job.state,
      sceneCount,
      model: job.report.usage.model,
      tokensIn: job.report.usage.tokensIn,
      tokensOut: job.report.usage.tokensOut,
      costUsd: job.report.usage.costUsd,
      storyboardPath: job.report.storyboardPath,
    };
  } finally {
    await stopRenderApi(child);
    deleteKeychainEntry(keychainService);
    await rm(mediaRoot, { recursive: true, force: true });
  }
}

async function runFailureScenario({ toolchainEnv }) {
  const keychainService = `Video Maker Smoke ${process.pid}-bad`;
  const mediaRoot = await mkdtemp(join(tmpdir(), 'vm-storyboard-smoke-bad-'));
  let child;
  try {
    await cloneProject(mediaRoot);
    child = spawnRenderApi(FAILURE_PORT, mediaRoot, keychainService, toolchainEnv);
    await waitForHttp(`http://${HTTP_HOST}:${FAILURE_PORT}/health`, SERVER_READY_TIMEOUT_MS);

    const settingsResult = await putJson(FAILURE_PORT, '/settings/producer', {
      engine: 'openrouter',
      models: { openrouter: MODEL_ID },
    });
    if (settingsResult.status !== 200) {
      throw new Error(`PUT /settings/producer failed: ${settingsResult.status} ${JSON.stringify(settingsResult.body)}`);
    }

    const keyResult = await putJson(FAILURE_PORT, '/settings/producer/openrouter-key', {
      apiKey: FAKE_OPENROUTER_KEY,
      verify: false,
    });
    if (keyResult.status !== 200) {
      throw new Error(`PUT /settings/producer/openrouter-key (fake key, unverified) failed: ${keyResult.status}`);
    }

    const created = await postJson(FAILURE_PORT, `/projects/${SOURCE_PROJECT_SLUG}/jobs`, {
      kind: 'storyboard',
      brief: BRIEF_TEXT,
    });
    if (created.status !== 202) {
      throw new Error(`POST storyboard job failed: ${created.status} ${JSON.stringify(created.body)}`);
    }

    const job = await pollJobUntilTerminal(FAILURE_PORT, created.body.id, JOB_POLL_TIMEOUT_MS, JOB_POLL_INTERVAL_MS);
    if (job === null) {
      throw new Error('storyboard job did not reach a terminal state before the poll timeout');
    }
    assertNoKeyLeak(job, 'the job record returned by the API');

    const acceptedCodes = new Set(['OPENROUTER_KEY_MISSING', 'AI_AGENT_FAILED']);
    if (job.state !== 'failed' || !acceptedCodes.has(job.error?.code)) {
      throw new Error(`expected a failed job with code OPENROUTER_KEY_MISSING or AI_AGENT_FAILED, got state=${job.state} code=${job.error?.code}`);
    }

    return { ok: true, jobState: job.state, errorCode: job.error.code };
  } finally {
    await stopRenderApi(child);
    deleteKeychainEntry(keychainService);
    await rm(mediaRoot, { recursive: true, force: true });
  }
}

function renderReport({ success, failure, totalCostUsd, keyNeverLeaked }) {
  const lines = [
    '# Storyboard on OpenRouter — real smoke',
    '',
    `Date: ${new Date().toISOString()}`,
    `Model: ${MODEL_ID}`,
    `Budget cap: US$${BUDGET_CAP_USD.toFixed(2)} · observed cost: US$${totalCostUsd.toFixed(6)}`,
    `Key leak check: ${keyNeverLeaked ? 'PASSED (the OpenRouter key never appears in this report or in job output)' : 'FAILED'}`,
    '',
    '## Success path (real key, engine=openrouter)',
    '',
    `- Attempts until success: ${success.attempts} (a schema-noncompliant generation is a real, transient AI_AGENT_INVALID_OUTPUT — the storyboard panel already tells the user to propose again)`,
    `- Job state: ${success.jobState}`,
    `- Storyboard path: ${success.storyboardPath}`,
    `- Scene count: ${success.sceneCount}`,
    `- usage.model: ${success.model}`,
    `- usage.tokensIn / tokensOut: ${success.tokensIn} / ${success.tokensOut}`,
    `- usage.costUsd: ${success.costUsd}`,
    '',
    '## Failure path (well-formed but wrong key, stored unverified)',
    '',
    `- Job state: ${failure.jobState}`,
    `- Error code: ${failure.errorCode}`,
    '- No completion was billed: OpenRouter rejects an invalid key with 401 before running the model.',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const toolchainEnv = await loadToolchainEnv();
  const realKey = readOpenRouterKeyFromKeychain();
  const timelineCore = loadTimelineCoreModule();

  log('smoke', 'running success scenario (real key, deepseek/deepseek-v4.1-flash)...');
  const success = await runSuccessScenario({ toolchainEnv, realKey, timelineCore });
  log('smoke', `success scenario: job ${success.jobState}, ${success.sceneCount} scenes, cost US$${success.costUsd}`);

  log('smoke', 'running failure scenario (wrong key, no spending expected)...');
  const failure = await runFailureScenario({ toolchainEnv });
  log('smoke', `failure scenario: job ${failure.jobState}, code ${failure.errorCode}`);

  const totalCostUsd = (success.costUsd ?? 0);
  if (totalCostUsd > BUDGET_CAP_USD) {
    throw new Error(`budget exceeded: observed US$${totalCostUsd} > cap US$${BUDGET_CAP_USD}`);
  }

  const report = renderReport({ success, failure, totalCostUsd, keyNeverLeaked: true });
  assertNoKeyLeak(report, 'the generated report');
  await writeFile(REPORT_PATH, report, 'utf8');
  log('smoke', `report written to ${REPORT_PATH}`);
}

main().catch((error) => {
  process.stderr.write(`[smoke] FAILED: ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
