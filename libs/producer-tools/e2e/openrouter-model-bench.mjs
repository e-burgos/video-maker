import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DEFAULT_ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-018-producer-free-tier/cycles/cycle-04/artifacts',
);
const DEFAULT_REPORT_NAME = 'openrouter-model-bench';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const SOURCE_PROJECT_SLUG = 'display-ads-analiticas';
const AROLL_ROLE = 'aroll';
const SCRIPT_RELATIVE_PATH = 'work/producer/script.txt';
const VOICE_OUTPUT_RELATIVE_PATH = 'work/voice/voice.wav';
const VOICE_ID = 'es_AR-daniela-high';
const KEYCHAIN_SERVICE = 'Video Maker';
const KEYCHAIN_ACCOUNT = 'openrouter';
const KEY_LEAK_PATTERN = 'sk-or-';

const TOOLCHAIN_ENV_NAMES = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
  'TTS_CLI_PATH',
  'TTS_VOICES_DIR',
];

const USER_MESSAGE =
  'Mirá el material de este proyecto: medí el A-roll, mirá 3 frames repartidos y escribí en ' +
  'work/producer/script.txt un guion de 4 a 6 líneas con marcas [m:ss] sincronizadas con lo que ' +
  'pasa en pantalla. Después generá la voz con Daniela. No hagas montaje ni render.';

const DEFAULT_CANDIDATES = [
  { id: 'google/gemma-4-31b-it:free', tier: 'free', reason: 'Familia Gemma (Google), gratis, tools+image confirmados en vivo.' },
  { id: 'qwen/qwen3.8-27b:free', tier: 'free', reason: 'Familia Qwen, gratis, tools+image confirmados en vivo.' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', tier: 'free', reason: 'Familia Nemotron (NVIDIA), multimodal nativo, gratis.' },
  { id: 'google/gemma-4-26b-a4b-it:free', tier: 'free', reason: 'Variante MoE de Gemma 4, gratis, más liviana que la 31B.' },
  { id: 'google/gemini-2.5-flash-lite', tier: 'cheap', reason: 'Gemini Flash-Lite, ~US$0.10/1M tokens de entrada, tools+image.' },
  { id: 'openai/gpt-5-nano', tier: 'cheap', reason: 'GPT-5 nano, ~US$0.05/1M tokens de entrada, el más barato de pago del catálogo con tools+image.' },
  { id: 'deepseek/deepseek-v4.1-flash', tier: 'cheap', reason: 'DeepSeek Flash, ~US$0.15/1M tokens de entrada, contexto de 1M.' },
  { id: 'anthropic/claude-haiku-4.5', tier: 'reference', reason: 'Referencia paga de calidad conocida (Claude), para comparar contra los baratos.' },
];

const DEFAULT_RUNS_PER_MODEL = 2;
const MAX_RUNS_PER_MODEL = 3;
const DEFAULT_TOTAL_BUDGET_USD = 3.0;
const DEFAULT_PER_RUN_BUDGET_USD = 0.4;
const MAX_STEPS_PER_RUN = 20;
const RUN_WALL_CLOCK_DEADLINE_MS = 5 * 60 * 1000;
const VOICE_JOB_POLL_TIMEOUT_MS = 90 * 1000;
const VOICE_JOB_POLL_INTERVAL_MS = 3000;
const FREE_MODEL_PACE_MS = 9000;
const PAID_MODEL_PACE_MS = 2000;
const rateLimitPolicy = { backoffMs: 20000, retries: 1 };
const DEFAULT_BASE_PORT = 4520;

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (const entry of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/u.exec(entry);
    if (match === null) {
      continue;
    }
    args[match[1]] = match[2] ?? 'true';
  }
  return args;
}

function assertNoKeyLeak(value, where) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text !== undefined && text.includes(KEY_LEAK_PATTERN)) {
    throw new Error(`refusing to write ${where}: found an OpenRouter-looking secret in the output`);
  }
}

function readOpenRouterKeyFromKeychain() {
  const raw = execFileSync(
    '/usr/bin/security',
    ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'],
    { encoding: 'utf8' },
  );
  const key = raw.trim();
  if (key === '') {
    throw new Error('the OpenRouter key in the macOS keychain is empty');
  }
  return key;
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
  return env;
}

function loadProducerToolsModule() {
  process.env.SWC_NODE_PROJECT = join(REPO_ROOT, 'tsconfig.base.json');
  const requireFromRepo = createRequire(join(REPO_ROOT, 'package.json'));
  const Module = requireFromRepo('node:module');
  const nodeJsLoader = Module._extensions['.js'];
  requireFromRepo('@swc-node/register');
  Module._extensions['.js'] = nodeJsLoader;
  return requireFromRepo(join(REPO_ROOT, 'libs/producer-tools/src/index.ts'));
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

function spawnRenderApi(port, mediaRoot, toolchainEnv) {
  const child = spawn(
    process.execPath,
    ['-r', join(REPO_ROOT, 'apps/render-api/src/server-register.cjs'), join(REPO_ROOT, 'apps/render-api/src/main.ts')],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ...toolchainEnv,
        RENDER_API_PORT: String(port),
        RENDER_API_HOST: '127.0.0.1',
        RENDER_API_MEDIA_ROOT: mediaRoot,
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
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  if (await waitForExit(child, 3000)) {
    return;
  }
  child.kill('SIGKILL');
  if (!(await waitForExit(child, 3000))) {
    log('bench', `render-api pid ${child.pid} did not exit after SIGKILL`);
  }
}

async function cloneProject(destRoot) {
  const source = join(REPO_ROOT, 'media', SOURCE_PROJECT_SLUG);
  const dest = join(destRoot, SOURCE_PROJECT_SLUG);
  execFileSync('cp', ['-Rc', source, dest]);
  await rm(join(dest, 'work', 'producer'), { recursive: true, force: true });
  await rm(join(dest, 'work', 'voice'), { recursive: true, force: true });
  await mkdir(join(dest, 'work', 'producer'), { recursive: true });
  await mkdir(join(dest, 'out'), { recursive: true });
  return dest;
}

async function ffprobeDurationSeconds(ffprobePath, filePath) {
  const raw = execFileSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { encoding: 'utf8' });
  return Number(raw.trim());
}

function parseTimeMark(line) {
  const match = /^\s*\[(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?\]/u.exec(line);
  if (match === null) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

function scoreScript(content, arollDurationSeconds) {
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  const lineCount = lines.length;
  const countInRange = lineCount >= 4 && lineCount <= 6;
  const marks = lines.map(parseTimeMark);
  const allMarked = marks.every((mark) => mark !== null);
  const increasing = marks.every((mark, index) => index === 0 || (mark ?? -1) > (marks[index - 1] ?? -1));
  const withinDuration = marks.every((mark) => mark === null || arollDurationSeconds === null || mark <= arollDurationSeconds + 5);
  return {
    valid: countInRange && allMarked && increasing && withinDuration,
    lineCount,
    allMarked,
    increasing,
    withinDuration,
  };
}

function looksSpanish(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return false;
  }
  const accentPattern = /[áéíóúñ¡¿]/iu;
  const commonWords = /\b(el|la|los|las|de|que|para|con|guion|voz|proyecto|video)\b/iu;
  return accentPattern.test(text) || commonWords.test(text);
}

async function readRecentJobs(port, slug) {
  const response = await fetch(`http://127.0.0.1:${port}/projects/${slug}/jobs`);
  const body = await response.json();
  return body.jobs ?? [];
}

async function pollJobUntilTerminal(port, jobId, timeoutMs, intervalMs) {
  const terminal = new Set(['succeeded', 'failed', 'canceled']);
  const deadline = Date.now() + timeoutMs;
  let job = null;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/jobs/${encodeURIComponent(jobId)}`);
    if (response.ok) {
      job = await response.json();
      if (terminal.has(job.state)) {
        return job;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return job;
}

async function runOneAttempt({ producerTools, apiKey, candidate, port, mediaRoot, arollPath, arollDurationSeconds }) {
  const client = producerTools.createHttpRenderApiClient({
    apiUrl: `http://127.0.0.1:${port}`,
    slug: SOURCE_PROJECT_SLUG,
  });

  const [detail, assets, producerScript] = await Promise.all([
    client.getProjectDetail(),
    client.listProjectAssets(),
    client.readProducerScriptState(),
  ]);

  const systemPrompt = producerTools.buildProducerPrompt({
    assetSource: detail.assetSource,
    assets: assets.map((asset) => ({ path: asset.path, role: asset.role, durationMs: asset.media?.durationMs ?? null })),
    pendingAssets: [],
    hasTimeline: detail.layout.timeline,
    producerScript,
  });

  const toolCalls = [];
  const toolResults = [];
  let finalText = '';

  const controller = new AbortController();
  const deadlineTimer = setTimeout(() => controller.abort(), RUN_WALL_CLOCK_DEADLINE_MS);

  const startedAt = Date.now();
  let runtimeResult = null;
  let runtimeError = null;

  try {
    runtimeResult = await producerTools.runOpenRouterProducerTurn({
      apiKey,
      model: candidate.id,
      systemPrompt,
      history: [],
      userText: USER_MESSAGE,
      client,
      turnModel: 'haiku',
      supportsImages: true,
      abortSignal: controller.signal,
      maxSteps: MAX_STEPS_PER_RUN,
      onEvent: (event) => {
        if (event.type === 'text' && event.text !== '') {
          finalText = `${finalText}${event.text}`;
        }
        if (event.type === 'tool') {
          toolCalls.push({ name: event.name, input: event.input });
        }
        if (event.type === 'tool-result') {
          toolResults.push({ name: event.name, isError: event.isError });
        }
      },
    });
  } catch (cause) {
    runtimeError = cause;
  } finally {
    clearTimeout(deadlineTimer);
  }

  const seconds = (Date.now() - startedAt) / 1000;

  if (runtimeResult !== null) {
    finalText = runtimeResult.finalText;
  }

  const toolName = (name) => producerTools.claudeCodeToolName(name);
  const calledOverview = toolCalls.some((call) => call.name === toolName('get_project_overview'));
  const probedAroll = toolCalls.some(
    (call) => call.name === toolName('probe_media') && typeof call.input?.path === 'string' && call.input.path === arollPath,
  );
  const extractFrameCalls = toolCalls.filter((call) => call.name === toolName('extract_frames'));
  const distinctFrameSeconds = new Set();
  for (const call of extractFrameCalls) {
    for (const seconds of call.input?.atSeconds ?? []) {
      distinctFrameSeconds.add(seconds);
    }
  }
  const framesCount = distinctFrameSeconds.size;

  const forbiddenJobCalls = toolCalls.filter(
    (call) => call.name === toolName('start_job') && ['render', 'montage'].includes(call.input?.job?.kind),
  );

  let scriptCheck = { valid: false, lineCount: 0, allMarked: false, increasing: false, withinDuration: false };
  try {
    const scriptPath = join(mediaRoot, SOURCE_PROJECT_SLUG, SCRIPT_RELATIVE_PATH);
    const content = await readFile(scriptPath, 'utf8');
    scriptCheck = scoreScript(content, arollDurationSeconds);
  } catch {
    scriptCheck = { valid: false, lineCount: 0, allMarked: false, increasing: false, withinDuration: false };
  }

  const jobsAfterTurn = await readRecentJobs(port, SOURCE_PROJECT_SLUG);
  const voiceJobsSeen = jobsAfterTurn.filter((job) => job.kind === 'voice');
  const otherForbiddenJobsSeen = jobsAfterTurn.filter((job) => ['render', 'montage'].includes(job.kind));

  let voiceJobSucceeded = false;
  if (voiceJobsSeen.length > 0) {
    const latestVoiceJob = voiceJobsSeen.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const settled = await pollJobUntilTerminal(port, latestVoiceJob.id, VOICE_JOB_POLL_TIMEOUT_MS, VOICE_JOB_POLL_INTERVAL_MS);
    voiceJobSucceeded = settled?.state === 'succeeded';
  }

  const voiceFileExists = existsSync(join(mediaRoot, SOURCE_PROJECT_SLUG, VOICE_OUTPUT_RELATIVE_PATH));
  const finalAnswerSpanish = looksSpanish(finalText);

  const criteria = runtimeError === null
    ? {
        calledOverview,
        probedAroll,
        framesCount3OrMore: framesCount >= 3,
        scriptValid: scriptCheck.valid,
        voiceJobSucceeded: voiceJobSucceeded && voiceFileExists,
        noMontageOrRender: forbiddenJobCalls.length === 0 && otherForbiddenJobsSeen.length === 0,
        finalAnswerSpanish,
      }
    : {
        calledOverview,
        probedAroll,
        framesCount3OrMore: framesCount >= 3,
        scriptValid: scriptCheck.valid,
        voiceJobSucceeded: false,
        noMontageOrRender: forbiddenJobCalls.length === 0 && otherForbiddenJobsSeen.length === 0,
        finalAnswerSpanish: false,
      };
  const success = runtimeError === null && Object.values(criteria).every(Boolean);

  const errorMessage = runtimeError !== null ? String(runtimeError.message ?? runtimeError) : '';
  const explicitRateLimit =
    (runtimeError instanceof producerTools.OpenRouterProducerRuntimeError && runtimeError.code === 'OPENROUTER_RATE_LIMITED') ||
    /rate limit/iu.test(errorMessage);
  const explicitDailyQuota =
    (runtimeError instanceof producerTools.OpenRouterProducerRuntimeError && runtimeError.code === 'OPENROUTER_FREE_QUOTA_EXHAUSTED') ||
    /per-day/iu.test(errorMessage);

  const rateLimited = explicitRateLimit || explicitDailyQuota;
  const dailyQuotaExhausted = explicitDailyQuota;

  return {
    candidateId: candidate.id,
    tier: candidate.tier,
    startedAt: new Date(startedAt).toISOString(),
    seconds,
    steps: runtimeResult?.steps ?? null,
    usage: runtimeResult?.usage ?? { inputTokens: null, outputTokens: null, costUsd: null },
    toolCallNames: toolCalls.map((call) => call.name),
    toolErrorCount: toolResults.filter((result) => result.isError).length,
    framesRequested: [...distinctFrameSeconds],
    scriptLineCount: scriptCheck.lineCount,
    finalTextPreview: finalText.slice(0, 400),
    criteria,
    success,
    rateLimited,
    dailyQuotaExhausted,
    errorCode: runtimeError instanceof producerTools.OpenRouterProducerRuntimeError ? runtimeError.code : (runtimeError !== null ? 'UNEXPECTED' : null),
    errorHint: runtimeError !== null
      ? errorMessage.slice(0, 500)
      : null,
  };
}

async function runOneRun(options) {
  const { producerTools, apiKey, candidate, port, toolchainEnv, arollDurationSeconds } = options;
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'openrouter-model-bench-'));
  const projectRoot = await cloneProject(tempMediaRoot);
  const arollAbsolutePath = join(projectRoot, 'raw', 'aroll', 'analiticas.mp4');
  if (!existsSync(arollAbsolutePath)) {
    throw new Error(`A-roll not found at ${arollAbsolutePath} after cloning`);
  }

  const child = spawnRenderApi(port, tempMediaRoot, toolchainEnv);
  try {
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);

    const clientForAssets = producerTools.createHttpRenderApiClient({
      apiUrl: `http://127.0.0.1:${port}`,
      slug: SOURCE_PROJECT_SLUG,
    });
    const assets = await clientForAssets.listProjectAssets();
    const arollAsset = assets.find((asset) => asset.role === AROLL_ROLE) ?? assets.find((asset) => asset.path.includes('aroll'));
    const arollPath = arollAsset?.path ?? 'raw/aroll/analiticas.mp4';

    let attempt = await runOneAttempt({
      producerTools,
      apiKey,
      candidate,
      port,
      mediaRoot: tempMediaRoot,
      arollPath,
      arollDurationSeconds,
    });

    if (attempt.rateLimited && attempt.dailyQuotaExhausted) {
      log(candidate.id, 'rate limited by a per-day quota, not a per-minute one: skipping the backoff retry, it would not help today');
    }
    for (let retry = 0; retry < rateLimitPolicy.retries && attempt.rateLimited && !attempt.dailyQuotaExhausted; retry += 1) {
      log(candidate.id, `rate limited, backing off ${rateLimitPolicy.backoffMs}ms (retry ${retry + 1}/${rateLimitPolicy.retries})`);
      await new Promise((resolve) => setTimeout(resolve, rateLimitPolicy.backoffMs));
      attempt = await runOneAttempt({
        producerTools,
        apiKey,
        candidate,
        port,
        mediaRoot: tempMediaRoot,
        arollPath,
        arollDurationSeconds,
      });
    }

    return attempt;
  } finally {
    await stopRenderApi(child);
    await rm(tempMediaRoot, { recursive: true, force: true });
  }
}

function average(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) {
    return null;
  }
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function summarizeModel(candidate, runs) {
  const successCount = runs.filter((run) => run.success).length;
  const rateLimitedCount = runs.filter((run) => run.rateLimited).length;
  const criteriaTotals = {};
  for (const run of runs) {
    for (const [key, value] of Object.entries(run.criteria ?? {})) {
      criteriaTotals[key] = (criteriaTotals[key] ?? 0) + (value ? 1 : 0);
    }
  }
  return {
    id: candidate.id,
    tier: candidate.tier,
    reason: candidate.reason,
    runs: runs.length,
    successCount,
    successRate: runs.length === 0 ? 0 : successCount / runs.length,
    rateLimitedCount,
    avgSteps: average(runs.map((run) => run.steps)),
    avgSeconds: average(runs.map((run) => run.seconds)),
    avgCostUsd: average(runs.map((run) => run.usage?.costUsd)),
    totalCostUsd: runs.reduce((sum, run) => sum + (run.usage?.costUsd ?? 0), 0),
    criteriaTotals,
    imagesSupported: true,
  };
}

function pickRecommendation(summaries) {
  const byTier = { free: [], cheap: [], reference: [] };
  for (const summary of summaries) {
    byTier[summary.tier]?.push(summary);
  }
  const passing = (list) => list.filter((summary) => summary.successRate >= 0.5).sort((a, b) => b.successRate - a.successRate || (a.avgCostUsd ?? 0) - (b.avgCostUsd ?? 0));

  const recommended = [];
  const bestFree = passing(byTier.free)[0];
  if (bestFree !== undefined) {
    recommended.push(bestFree);
  }
  const bestCheap = passing(byTier.cheap)[0];
  if (bestCheap !== undefined) {
    recommended.push(bestCheap);
  }
  const bestReference = passing(byTier.reference)[0];
  if (bestReference !== undefined) {
    recommended.push(bestReference);
  }

  const twoOfTwo = summaries.filter((summary) => summary.successRate === 1 && summary.runs >= 2);
  const cheapest2of2 = twoOfTwo.sort((a, b) => (a.avgCostUsd ?? 0) - (b.avgCostUsd ?? 0))[0];
  const fallbackDefault = passing(summaries).sort((a, b) => b.successRate - a.successRate || (a.avgCostUsd ?? 0) - (b.avgCostUsd ?? 0))[0];
  const defaultModel = cheapest2of2 ?? fallbackDefault ?? summaries[0];

  return { recommended, defaultModel };
}

async function discoverLiveFreeCandidates() {
  const response = await fetch(OPENROUTER_MODELS_URL);
  if (!response.ok) {
    throw new Error(`OpenRouter catalog answered ${response.status}`);
  }
  const catalog = await response.json();
  return catalog.data
    .filter((model) => model.id.endsWith(':free'))
    .filter((model) => (model.supported_parameters ?? []).includes('tools'))
    .filter((model) => (model.architecture?.input_modalities ?? []).includes('image'))
    .map((model) => ({
      id: model.id,
      tier: 'free',
      reason: `Gratis y vivo en el catálogo con tools e imagen (contexto ${model.context_length ?? 'n/d'}).`,
    }));
}

function resolveCandidates(args, discoveredFree) {
  if (discoveredFree !== null) {
    return discoveredFree;
  }
  if (args.candidates === undefined) {
    return DEFAULT_CANDIDATES;
  }
  return args.candidates
    .split(',')
    .map((id) => id.trim())
    .map((id) => DEFAULT_CANDIDATES.find((candidate) => candidate.id === id) ?? { id, tier: id.endsWith(':free') ? 'free' : 'cheap', reason: 'pasado por --candidates' });
}

function renderMarkdown({ title, candidates, summaries, totalSpent, budgetCapUsd, recommendation, notes }) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> Generado el ${new Date().toISOString().slice(0, 10)} corriendo el runtime real del productor ` +
    '(`runOpenRouterProducerTurn`) contra un clon APFS del proyecto `display-ads-analiticas`, con un ' +
    `render-api real levantado por corrida. Tope de gasto total: US$${budgetCapUsd.toFixed(2)}.`);
  lines.push('');
  lines.push('## Candidatos y por qué');
  lines.push('');
  lines.push('| Modelo | Tier | Motivo |');
  lines.push('| --- | --- | --- |');
  for (const candidate of candidates) {
    lines.push(`| \`${candidate.id}\` | ${candidate.tier} | ${candidate.reason} |`);
  }
  lines.push('');
  lines.push(
    'Filtro aplicado sobre `GET https://openrouter.ai/api/v1/models` (sin key): `tools` en ' +
    '`supported_parameters` y `image` en `architecture.input_modalities` — el escenario necesita ' +
    '`extract_frames` como imagen. Se excluyeron variantes `:batch`, `openrouter/auto*` y `stealth/*` ' +
    'por no ser modelos reales o predecibles para un loop interactivo.',
  );
  lines.push('');
  lines.push('## Escenario');
  lines.push('');
  lines.push(
    '`get_project_overview` → `probe_media` del A-roll → `extract_frames` con 3 marcas de tiempo → ' +
    '`write_project_text` de `work/producer/script.txt` (4 a 6 líneas, cada una con `[m:ss]` válido y ' +
    'creciente, dentro de la duración del A-roll) → `start_job {job:{kind:"voice"}}` con la voz Daniela, ' +
    'verificado hasta que el job termina → sin `montage` ni `render`. Cada criterio se puntúa desde el ' +
    'estado real del servidor (archivos y jobs), nunca desde lo que dice el modelo. 2 corridas por modelo ' +
    '(hasta 3 si el resultado es dispar y el presupuesto lo permite).',
  );
  lines.push('');
  lines.push('## Resultados por modelo');
  lines.push('');
  lines.push('| Modelo | Tier | Éxito | Pasos prom. | Seg. prom. | Costo prom. | Costo total | Rate-limit | Imágenes |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const summary of summaries) {
    lines.push(
      `| \`${summary.id}\` | ${summary.tier} | ${summary.successCount}/${summary.runs} ` +
      `(${(summary.successRate * 100).toFixed(0)}%) | ${summary.avgSteps?.toFixed(1) ?? 'n/d'} | ` +
      `${summary.avgSeconds?.toFixed(1) ?? 'n/d'} | US$${(summary.avgCostUsd ?? 0).toFixed(4)} | ` +
      `US$${summary.totalCostUsd.toFixed(4)} | ${summary.rateLimitedCount} | sí |`,
    );
  }
  lines.push('');
  lines.push('### Criterios pasados por modelo (de las corridas realizadas)');
  lines.push('');
  lines.push('| Modelo | overview | probe A-roll | ≥3 frames | guion válido | voz OK | sin montaje/render | respuesta ES |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const summary of summaries) {
    const c = summary.criteriaTotals;
    lines.push(
      `| \`${summary.id}\` | ${c.calledOverview ?? 0}/${summary.runs} | ${c.probedAroll ?? 0}/${summary.runs} | ` +
      `${c.framesCount3OrMore ?? 0}/${summary.runs} | ${c.scriptValid ?? 0}/${summary.runs} | ` +
      `${c.voiceJobSucceeded ?? 0}/${summary.runs} | ${c.noMontageOrRender ?? 0}/${summary.runs} | ` +
      `${c.finalAnswerSpanish ?? 0}/${summary.runs} |`,
    );
  }
  lines.push('');
  lines.push(`## Gasto total: US$${totalSpent.toFixed(4)} de un tope de US$${budgetCapUsd.toFixed(2)}`);
  lines.push('');
  if (notes.length > 0) {
    lines.push('## Notas de la corrida');
    lines.push('');
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  lines.push('## Recomendación');
  lines.push('');
  lines.push('Set recomendado (2 a 4 modelos, por tier):');
  lines.push('');
  for (const summary of recommendation.recommended) {
    lines.push(
      `- **${summary.tier}** — \`${summary.id}\`: ${summary.successCount}/${summary.runs} corridas exitosas, ` +
      `costo promedio US$${(summary.avgCostUsd ?? 0).toFixed(4)}, ${summary.avgSteps?.toFixed(1) ?? 'n/d'} pasos ` +
      `promedio.`,
    );
  }
  lines.push('');
  if (recommendation.defaultModel !== undefined) {
    lines.push(
      `**Modelo por defecto propuesto:** \`${recommendation.defaultModel.id}\` (${recommendation.defaultModel.tier}) — ` +
      `${recommendation.defaultModel.successCount}/${recommendation.defaultModel.runs} corridas exitosas a ` +
      `US$${(recommendation.defaultModel.avgCostUsd ?? 0).toFixed(4)} promedio por corrida. Se prioriza el más ` +
      'barato que pasó 2/2, ya que el productor encadena decenas de llamadas y un modelo confiable y gratuito o ' +
      'muy barato es lo que hace viable que un amigo sin Claude lo use sin pensar en el costo.',
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const discoveredFree = args['discover-free'] !== undefined ? await discoverLiveFreeCandidates() : null;
  const candidates = resolveCandidates(args, discoveredFree);
  const artifactsDir = args.out !== undefined ? args.out : DEFAULT_ARTIFACTS_DIR;
  const reportName = args['report-name'] !== undefined ? args['report-name'] : DEFAULT_REPORT_NAME;
  rateLimitPolicy.backoffMs = args['backoff-ms'] !== undefined ? Number(args['backoff-ms']) : rateLimitPolicy.backoffMs;
  rateLimitPolicy.retries = args['rate-limit-retries'] !== undefined ? Number(args['rate-limit-retries']) : rateLimitPolicy.retries;
  const basePort = args['base-port'] !== undefined ? Number(args['base-port']) : DEFAULT_BASE_PORT;
  const reportTitle = args.title !== undefined ? args.title : 'Benchmark de modelos OpenRouter';

  const budgetCapUsd = args.budget !== undefined ? Number(args.budget) : DEFAULT_TOTAL_BUDGET_USD;
  const perRunBudgetUsd = args['per-run-budget'] !== undefined ? Number(args['per-run-budget']) : DEFAULT_PER_RUN_BUDGET_USD;
  const runsPerModel = args.runs !== undefined ? Number(args.runs) : DEFAULT_RUNS_PER_MODEL;

  log('bench', `candidates=${candidates.length} budgetCapUsd=${budgetCapUsd} perRunBudgetUsd=${perRunBudgetUsd} runsPerModel=${runsPerModel}`);

  const apiKey = readOpenRouterKeyFromKeychain();
  const toolchainEnv = await loadToolchainEnv();
  const producerTools = loadProducerToolsModule();

  const ffprobePath = toolchainEnv.FFPROBE_PATH ?? 'ffprobe';
  const arollDurationSeconds = await ffprobeDurationSeconds(
    ffprobePath,
    join(REPO_ROOT, 'media', SOURCE_PROJECT_SLUG, 'raw', 'aroll', 'analiticas.mp4'),
  );
  log('bench', `A-roll duration: ${arollDurationSeconds.toFixed(1)}s`);

  await mkdir(artifactsDir, { recursive: true });

  const allRuns = [];
  const notes = [];
  let totalSpent = 0;
  let budgetExhausted = false;
  let freeDailyQuotaExhausted = false;

  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (budgetExhausted) {
      notes.push(`\`${candidate.id}\` se saltó por completo: se había agotado el presupuesto total.`);
      continue;
    }

    if (freeDailyQuotaExhausted && candidate.tier === 'free') {
      notes.push(`\`${candidate.id}\` se saltó: la cuota diaria de modelos gratis de la cuenta ya estaba agotada.`);
      continue;
    }

    const port = basePort + candidateIndex;
    const runsForModel = [];

    for (let runIndex = 0; runIndex < runsPerModel; runIndex += 1) {
      if (totalSpent >= budgetCapUsd) {
        budgetExhausted = true;
        notes.push(`Se detuvo el benchmark en \`${candidate.id}\` corrida ${runIndex + 1}: gasto acumulado US$${totalSpent.toFixed(4)} alcanzó el tope.`);
        break;
      }

      log(candidate.id, `run ${runIndex + 1}/${runsPerModel} starting (port ${port})`);
      let run;
      try {
        run = await runOneRun({ producerTools, apiKey, candidate, port, toolchainEnv, arollDurationSeconds });
      } catch (cause) {
        run = {
          candidateId: candidate.id,
          tier: candidate.tier,
          startedAt: new Date().toISOString(),
          seconds: null,
          steps: null,
          usage: { inputTokens: null, outputTokens: null, costUsd: null },
          toolCallNames: [],
          toolErrorCount: null,
          framesRequested: [],
          scriptLineCount: 0,
          criteria: {
            calledOverview: false,
            probedAroll: false,
            framesCount3OrMore: false,
            scriptValid: false,
            voiceJobSucceeded: false,
            noMontageOrRender: false,
            finalAnswerSpanish: false,
          },
          success: false,
          rateLimited: false,
          errorCode: 'RUN_INFRA_FAILED',
          errorHint: String(cause?.stack ?? cause).slice(0, 900),
        };
      }

      log(candidate.id, `run ${runIndex + 1} -> success=${run.success} steps=${run.steps} seconds=${run.seconds?.toFixed(1)} costUsd=${run.usage?.costUsd}`);

      totalSpent += run.usage?.costUsd ?? 0;
      if ((run.usage?.costUsd ?? 0) > perRunBudgetUsd) {
        notes.push(`\`${candidate.id}\` corrida ${runIndex + 1} superó el tope por corrida (US$${(run.usage.costUsd).toFixed(4)} > US$${perRunBudgetUsd}); tope real aplicado fue maxSteps=${MAX_STEPS_PER_RUN} + deadline de ${RUN_WALL_CLOCK_DEADLINE_MS / 1000}s, ya que el runtime no expone costo por paso.`);
      }

      runsForModel.push(run);
      allRuns.push(run);

      if (run.dailyQuotaExhausted === true) {
        freeDailyQuotaExhausted = true;
        log(candidate.id, 'free daily quota exhausted, skipping the remaining free runs');
        break;
      }

      const pace = candidate.tier === 'free' ? FREE_MODEL_PACE_MS : PAID_MODEL_PACE_MS;
      await new Promise((resolve) => setTimeout(resolve, pace));
    }

    const successes = runsForModel.filter((run) => run.success).length;
    const isBorderline = runsForModel.length === 2 && successes === 1;
    if (isBorderline && runsForModel.length < MAX_RUNS_PER_MODEL && !budgetExhausted) {
      const estimatedNext = average(runsForModel.map((run) => run.usage?.costUsd)) ?? 0;
      if (totalSpent + estimatedNext <= budgetCapUsd) {
        log(candidate.id, 'borderline result (1/2), running a 3rd attempt');
        let run;
        try {
          run = await runOneRun({ producerTools, apiKey, candidate, port, toolchainEnv, arollDurationSeconds });
        } catch (cause) {
          run = null;
        }
        if (run !== null) {
          totalSpent += run.usage?.costUsd ?? 0;
          runsForModel.push(run);
          allRuns.push(run);
        }
      } else {
        notes.push(`\`${candidate.id}\` fue dispar (1/2) pero no se corrió una 3ra por presupuesto.`);
      }
    }
  }

  const summaries = candidates.map((candidate) => summarizeModel(candidate, allRuns.filter((run) => run.candidateId === candidate.id)));
  const recommendation = pickRecommendation(summaries.filter((summary) => summary.runs > 0));

  for (const candidate of candidates) {
    const runsForModel = allRuns.filter((run) => run.candidateId === candidate.id);
    if (runsForModel.length > 0 && runsForModel.every((run) => run.dailyQuotaExhausted)) {
      notes.push(
        `\`${candidate.id}\` no se pudo evaluar hoy: OpenRouter devolvió ` +
        '`Rate limit exceeded: free-models-per-day-high-balance` en las ' +
        `${runsForModel.length} corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que ` +
        'un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con ' +
        `\`node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=${candidate.id} --runs=2\`.`,
      );
    }
  }

  const rawResults = {
    generatedAt: new Date().toISOString(),
    scenario: USER_MESSAGE,
    sourceProject: SOURCE_PROJECT_SLUG,
    arollDurationSeconds,
    budgetCapUsd,
    perRunBudgetUsd,
    totalSpentUsd: totalSpent,
    candidates,
    runs: allRuns,
    summaries,
    recommendation: {
      recommended: recommendation.recommended.map((summary) => summary.id),
      defaultModel: recommendation.defaultModel?.id ?? null,
    },
    notes,
  };

  assertNoKeyLeak(rawResults, `${reportName}-results.json`);

  const markdown = renderMarkdown({ title: reportTitle, candidates, summaries, totalSpent, budgetCapUsd, recommendation, notes });
  assertNoKeyLeak(markdown, `${reportName}.md`);

  await writeFile(join(artifactsDir, `${reportName}-results.json`), JSON.stringify(rawResults, null, 2), 'utf8');
  await writeFile(join(artifactsDir, `${reportName}.md`), markdown, 'utf8');

  log('bench', `wrote artifacts to ${artifactsDir}`);
  log('bench', `total spent: US$${totalSpent.toFixed(4)} of US$${budgetCapUsd.toFixed(2)}`);
  for (const summary of summaries) {
    log('bench', `${summary.id}: ${summary.successCount}/${summary.runs} success, avgCostUsd=${(summary.avgCostUsd ?? 0).toFixed(4)}`);
  }
}

main().catch((cause) => {
  console.error(`[failed] ${cause.stack ?? cause.message}`);
  process.exitCode = 1;
});
