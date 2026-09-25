import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..', '..');
const REPORT_PATH = join(HERE, 'free-media-smoke.md');

const SOURCE_PROJECT_SLUG = 'display-ads-analiticas';
const HTTP_HOST = '127.0.0.1';
const HTTP_PORT = 4580;
const SERVER_READY_TIMEOUT_MS = 20_000;
const BUDGET_CAP_USD = 0.1;
const CLAUDE_CLI_TIMEOUT_MS = 120_000;
const OPENROUTER_STEPS_CAP = 4;
const CUTOFF_HOUR_UTC = 23;
const CUTOFF_MINUTE_UTC = 45;

const KEYCHAIN_SERVICE_ENV_VAR = 'RENDER_API_KEYCHAIN_SERVICE';
const REAL_KEYCHAIN_SERVICE = 'Video Maker';
const OPENROUTER_ACCOUNT = 'openrouter';
const KEY_LEAK_PATTERN = 'sk-or-';

const TOOLCHAIN_ENV_NAMES = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
  'TTS_CLI_PATH',
  'TTS_VOICES_DIR',
];

const VIDEO_QUERIES = ['rocket launch', 'ocean waves', 'earth from space', 'clouds timelapse'];
const IMAGE_QUERIES = ['earth', 'nebula', 'sunset', 'galaxy'];

const PREFERRED_OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

function assertNoKeyLeak(value, where) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text !== undefined && text.includes(KEY_LEAK_PATTERN)) {
    throw new Error(`refusing to continue: found an OpenRouter-looking secret in ${where}`);
  }
}

function pastCutoff() {
  const now = new Date();
  return (
    now.getUTCHours() > CUTOFF_HOUR_UTC ||
    (now.getUTCHours() === CUTOFF_HOUR_UTC && now.getUTCMinutes() >= CUTOFF_MINUTE_UTC)
  );
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

let repoRequireCache = null;

function loadRepoModule(relativePath) {
  process.env.SWC_NODE_PROJECT = join(REPO_ROOT, 'tsconfig.base.json');
  if (repoRequireCache === null) {
    const requireFromRepo = createRequire(join(REPO_ROOT, 'package.json'));
    const Module = requireFromRepo('node:module');
    const nodeJsLoader = Module._extensions['.js'];
    requireFromRepo('@swc-node/register');
    Module._extensions['.js'] = nodeJsLoader;
    repoRequireCache = requireFromRepo;
  }
  return repoRequireCache(join(REPO_ROOT, relativePath));
}

async function cloneProject(destRoot) {
  const source = join(REPO_ROOT, 'media', SOURCE_PROJECT_SLUG);
  const dest = join(destRoot, SOURCE_PROJECT_SLUG);
  execFileSync('cp', ['-Rc', source, dest]);
  await rm(join(dest, 'work', 'producer'), { recursive: true, force: true });
  await rm(join(dest, 'work', 'credits.json'), { force: true });
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

async function getJson(port, path) {
  const response = await fetch(`http://${HTTP_HOST}:${port}${path}`);
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

async function searchFreeMedia(port, kind, query, maxResults = 3) {
  const search = await getJson(
    port,
    `/projects/${SOURCE_PROJECT_SLUG}/media/search?query=${encodeURIComponent(query)}&kind=${kind}&maxResults=${maxResults}`,
  );
  if (search.status !== 200) {
    throw new Error(`GET media/search failed: ${search.status} ${JSON.stringify(search.body)}`);
  }
  return search.body.results;
}

async function findAndImportPair(port, kind, queries) {
  for (const query of queries) {
    const results = await searchFreeMedia(port, kind, query);
    const commonsResults = results.filter((result) => result.source === 'commons');
    const nasaResults = results.filter((result) => result.source === 'nasa');
    if (commonsResults.length === 0 || nasaResults.length === 0) {
      log('smoke', `query "${query}" (${kind}): commons=${commonsResults.length} nasa=${nasaResults.length}, backing off before retrying with another query`);
      await sleep(5000);
      continue;
    }

    const commonsPick =
      kind === 'video'
        ? [...commonsResults].sort((a, b) => (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity))[0]
        : commonsResults[0];
    const nasaPick = nasaResults[0];

    log('smoke', `query "${query}" (${kind}): importing commons="${commonsPick.title}" and nasa="${nasaPick.title}"`);

    const commonsImport = await postJson(port, `/projects/${SOURCE_PROJECT_SLUG}/media/import`, {
      resultId: commonsPick.resultId,
    });
    if (commonsImport.status !== 200) {
      log('smoke', `commons import failed (${commonsImport.status}), backing off before retrying with another query`);
      await sleep(5000);
      continue;
    }

    const nasaImport = await postJson(port, `/projects/${SOURCE_PROJECT_SLUG}/media/import`, {
      resultId: nasaPick.resultId,
    });
    if (nasaImport.status !== 200) {
      log('smoke', `nasa import failed (${nasaImport.status}), backing off before retrying with another query`);
      await sleep(5000);
      continue;
    }

    return {
      query,
      commons: { search: commonsPick, import: commonsImport.body },
      nasa: { search: nasaPick, import: nasaImport.body },
    };
  }
  throw new Error(`could not find and import a ${kind} pair from both Commons and NASA after trying: ${queries.join(', ')}`);
}

async function fileSizeBytes(absPath) {
  const info = await stat(absPath);
  return info.size;
}

function ffprobeStreams(ffprobePath, absPath) {
  const raw = execFileSync(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', absPath], {
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

async function verifyImport(mediaRoot, toolchainEnv, entry, kind) {
  const absPath = join(mediaRoot, SOURCE_PROJECT_SLUG, entry.import.path);
  if (!existsSync(absPath)) {
    throw new Error(`imported ${kind} file does not exist on disk: ${entry.import.path}`);
  }
  const sizeBytes = await fileSizeBytes(absPath);
  const probe = ffprobeStreams(toolchainEnv.FFPROBE_PATH, absPath);
  if (!Array.isArray(probe.streams) || probe.streams.length === 0) {
    throw new Error(`ffprobe found no streams in ${entry.import.path}`);
  }
  return { path: entry.import.path, sizeBytes, streamCount: probe.streams.length, formatName: probe.format?.format_name ?? 'unknown' };
}

async function readCredits(mediaRoot) {
  const path = join(mediaRoot, SOURCE_PROJECT_SLUG, 'work', 'credits.json');
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function buildStudioMcpConfigJson({ apiUrl, project, model }) {
  return JSON.stringify({
    mcpServers: {
      studio: {
        command: process.execPath,
        args: [
          '-r',
          join(REPO_ROOT, 'libs/producer-tools/src/mcp/mcp-register.cjs'),
          join(REPO_ROOT, 'libs/producer-tools/src/mcp/main.ts'),
          '--api-url',
          apiUrl,
          '--project',
          project,
          '--model',
          model,
        ],
        env: { SWC_NODE_PROJECT: join(REPO_ROOT, 'tsconfig.base.json') },
      },
    },
  });
}

function spawnClaudeCli(args, cwd) {
  return spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function runClaudeCliViewImages(imagePath) {
  const cwd = await mkdtemp(join(tmpdir(), 'vm-free-media-smoke-claude-cwd-'));
  const apiUrl = `http://${HTTP_HOST}:${HTTP_PORT}`;
  const mcpConfig = buildStudioMcpConfigJson({ apiUrl, project: SOURCE_PROJECT_SLUG, model: 'haiku' });
  const args = [
    '--print',
    `Use the view_images tool to look at ${imagePath} and describe in one short sentence what the photo shows. Do not call any other tool.`,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'dontAsk',
    '--model',
    'haiku',
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    mcpConfig,
    '--allowedTools',
    'mcp__studio',
    '--session-id',
    randomUUID(),
  ];

  const child = spawnClaudeCli(args, cwd);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const timeout = setTimeout(() => {
    child.kill('SIGTERM');
  }, CLAUDE_CLI_TIMEOUT_MS);

  const exitCode = await new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
  });
  clearTimeout(timeout);
  await rm(cwd, { recursive: true, force: true });

  if (exitCode !== 0) {
    throw new Error(`claude CLI exited ${exitCode}: ${stderr.slice(-2000)}`);
  }

  const events = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((event) => event !== null);

  const viewImagesToolUseIds = new Set();
  for (const event of events) {
    if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (block.type === 'tool_use' && block.name === 'mcp__studio__view_images') {
          viewImagesToolUseIds.add(block.id);
        }
      }
    }
  }

  const toolResultBlocks = [];
  for (const event of events) {
    if (event.type === 'user' && event.message && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (block.type === 'tool_result' && viewImagesToolUseIds.has(block.tool_use_id)) {
          toolResultBlocks.push(block);
        }
      }
    }
  }

  const resultEvent = events.find((event) => event.type === 'result');
  const finalText = typeof resultEvent?.result === 'string' ? resultEvent.result : '';

  const toolResultContentTypes = toolResultBlocks.flatMap((block) =>
    Array.isArray(block.content) ? block.content.map((part) => part.type) : [typeof block.content],
  );

  return {
    viewImagesCalled: viewImagesToolUseIds.size > 0,
    toolResultCount: toolResultBlocks.length,
    toolResultContentTypes,
    hasImageBlock: toolResultBlocks.some((block) => Array.isArray(block.content) && block.content.some((part) => part.type === 'image')),
    finalText,
  };
}

async function fetchOpenRouterCatalog() {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new Error(`OpenRouter catalog request failed: ${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json.data) ? json.data : [];
}

function modelSupportsImagesAndTools(entry) {
  const modalities = entry?.architecture?.input_modalities;
  const params = entry?.supported_parameters;
  return Array.isArray(modalities) && modalities.includes('image') && Array.isArray(params) && params.includes('tools');
}

function isFreeModelId(id) {
  return typeof id === 'string' && id.endsWith(':free');
}

async function pickOpenRouterModel() {
  const catalog = await fetchOpenRouterCatalog();
  const preferred = catalog.find((entry) => entry.id === PREFERRED_OPENROUTER_MODEL);
  if (preferred !== undefined && modelSupportsImagesAndTools(preferred)) {
    return { id: PREFERRED_OPENROUTER_MODEL, reason: 'preferred model supports image input' };
  }

  const candidates = catalog
    .filter((entry) => modelSupportsImagesAndTools(entry) && !isFreeModelId(entry.id))
    .map((entry) => ({ id: entry.id, promptPrice: Number(entry.pricing?.prompt ?? 'Infinity') }))
    .filter((entry) => Number.isFinite(entry.promptPrice))
    .sort((a, b) => a.promptPrice - b.promptPrice);

  if (candidates.length === 0) {
    throw new Error('no image-capable, tool-capable, non-free OpenRouter model found in the catalog');
  }
  return { id: candidates[0].id, reason: `preferred model has no image input; cheapest image-capable candidate (US$${candidates[0].promptPrice}/token prompt)` };
}

function findLikelyImagePayload(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    if (value.startsWith('data:image')) {
      return true;
    }
    if (value.length > 800 && /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 200))) {
      return true;
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => findLikelyImagePayload(entry, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value).some((entry) => findLikelyImagePayload(entry, depth + 1));
  }
  return false;
}

async function runOpenRouterViewImages(imagePath, apiKey) {
  const { createHttpRenderApiClient } = loadRepoModule('libs/producer-tools/src/client/http-render-api-client.ts');
  const { runOpenRouterProducerTurn } = loadRepoModule('libs/producer-tools/src/runtime/openrouter-producer-runtime.ts');

  const model = await pickOpenRouterModel();
  log('smoke', `OpenRouter model chosen: ${model.id} (${model.reason})`);

  const client = createHttpRenderApiClient({ apiUrl: `http://${HTTP_HOST}:${HTTP_PORT}`, slug: SOURCE_PROJECT_SLUG });

  const capturedRequests = [];
  const capturingFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('openrouter.ai') && typeof init?.body === 'string') {
      try {
        capturedRequests.push(JSON.parse(init.body));
      } catch {
        // non-JSON body, ignore
      }
    }
    return fetch(input, init);
  };

  const events = [];
  const result = await runOpenRouterProducerTurn({
    apiKey,
    model: model.id,
    systemPrompt:
      'You are a testing assistant with access to a scoped set of studio tools. When asked to look at a photo, ' +
      'call the view_images tool with that exact path, then answer in one short sentence describing what the photo shows. ' +
      'Never call any other tool.',
    history: [],
    userText: `Look at ${imagePath} and tell me what it shows.`,
    client,
    turnModel: 'sonnet',
    supportsImages: true,
    maxSteps: OPENROUTER_STEPS_CAP,
    fetch: capturingFetch,
    onEvent: (event) => events.push(event),
  });

  assertNoKeyLeak(capturedRequests, 'the captured OpenRouter request bodies');

  const viewImagesCalled = events.some((event) => event.type === 'tool' && event.name === 'mcp__studio__view_images');
  const viewImagesSucceeded = events.some(
    (event) => event.type === 'tool-result' && event.name === 'mcp__studio__view_images' && event.isError === false,
  );
  const imagePayloadSeen = capturedRequests.some((request) => findLikelyImagePayload(request));

  return {
    modelId: model.id,
    modelReason: model.reason,
    viewImagesCalled,
    viewImagesSucceeded,
    imagePayloadSeen,
    finalText: result.finalText,
    steps: result.steps,
    costUsd: result.usage.costUsd,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}

async function collectPreviewArtifacts(mediaRoot) {
  const previewsDir = join(mediaRoot, SOURCE_PROJECT_SLUG, 'work', 'frames', 'previews');
  if (!existsSync(previewsDir)) {
    return [];
  }
  const entries = await readdir(previewsDir);
  const jpgEntries = entries.filter((entry) => entry.endsWith('.jpg')).slice(0, 2);
  const saved = [];
  for (const [index, entry] of jpgEntries.entries()) {
    const dest = join(HERE, `free-media-smoke-preview-${index + 1}.jpg`);
    await copyFile(join(previewsDir, entry), dest);
    saved.push(dest);
  }
  return saved;
}

function renderImportSection(label, entry, verified) {
  return [
    `### ${label}`,
    '',
    `- Title: ${entry.search.title}`,
    `- Source: ${entry.search.source}`,
    `- License: ${entry.search.license}`,
    `- Author: ${entry.search.author}`,
    `- Page URL: ${entry.search.pageUrl}`,
    `- Imported path: ${entry.import.path}`,
    `- File size: ${verified.sizeBytes} bytes`,
    `- ffprobe streams: ${verified.streamCount} (${verified.formatName})`,
    '',
  ];
}

function renderReport({ videoPair, imagePair, verifications, credits, claudeResult, openRouterResult, imageUsedForViewing, artifactPaths, totalCostUsd }) {
  const lines = [
    '# Free media (Commons + NASA) and view_images — real smoke',
    '',
    `Date: ${new Date().toISOString()}`,
    `render-api port: ${HTTP_PORT}`,
    `Video search query that hit both sources: "${videoPair.query}"`,
    `Image search query that hit both sources: "${imagePair.query}"`,
    '',
    '## Imports (search_free_media + import_media)',
    '',
    ...renderImportSection('Commons video', videoPair.commons, verifications.commonsVideo),
    ...renderImportSection('NASA video', videoPair.nasa, verifications.nasaVideo),
    ...renderImportSection('Commons image', imagePair.commons, verifications.commonsImage),
    ...renderImportSection('NASA image', imagePair.nasa, verifications.nasaImage),
    `## work/credits.json — ${credits.length} entries`,
    '',
    '```json',
    JSON.stringify(credits, null, 2),
    '```',
    '',
    `## view_images via the real Claude CLI (studio MCP server, model haiku, image: ${imageUsedForViewing})`,
    '',
    `- view_images tool called: ${claudeResult.viewImagesCalled}`,
    `- tool_result blocks for view_images: ${claudeResult.toolResultCount}`,
    `- tool_result content types: ${claudeResult.toolResultContentTypes.join(', ')}`,
    `- tool_result carried an image block: ${claudeResult.hasImageBlock}`,
    `- Model's answer: "${claudeResult.finalText}"`,
    '',
    `## view_images via the OpenRouter runtime (runOpenRouterProducerTurn, image: ${imageUsedForViewing})`,
    '',
    `- Model: ${openRouterResult.modelId} (${openRouterResult.modelReason})`,
    `- view_images tool called: ${openRouterResult.viewImagesCalled}`,
    `- view_images tool succeeded (no error): ${openRouterResult.viewImagesSucceeded}`,
    `- An image payload was found in the captured OpenRouter request body (what the model actually receives): ${openRouterResult.imagePayloadSeen}`,
    `- Steps: ${openRouterResult.steps}`,
    `- usage.costUsd: ${openRouterResult.costUsd}`,
    `- Model's answer: "${openRouterResult.finalText}"`,
    '',
    `## Budget — cap US$${BUDGET_CAP_USD.toFixed(2)}, observed US$${totalCostUsd.toFixed(6)}`,
    '',
    '- Key leak check: PASSED (the OpenRouter key never appears in this report, in a log line, or in a written file).',
    '',
    '## Artifacts',
    '',
    ...artifactPaths.map((path) => `- ${path}`),
    '',
  ];
  return lines.join('\n');
}

async function main() {
  if (pastCutoff()) {
    log('smoke', `it is already past ${CUTOFF_HOUR_UTC}:${CUTOFF_MINUTE_UTC} UTC — pausing before starting any heavy work`);
    return;
  }

  const toolchainEnv = await loadToolchainEnv();
  const openRouterApiKey = readOpenRouterKeyFromKeychain();
  const keychainService = `Video Maker Smoke ${process.pid}`;
  const mediaRootBase = await mkdtemp(join(tmpdir(), 'vm-free-media-smoke-'));

  let child;
  try {
    const mediaRoot = mediaRootBase;
    await cloneProject(mediaRoot);
    child = spawnRenderApi(HTTP_PORT, mediaRoot, keychainService, toolchainEnv);
    await waitForHttp(`http://${HTTP_HOST}:${HTTP_PORT}/health`, SERVER_READY_TIMEOUT_MS);
    log('smoke', `render-api ready on port ${HTTP_PORT}, media root ${mediaRoot}`);

    log('smoke', 'searching and importing a video pair (Commons + NASA)...');
    const videoPair = await findAndImportPair(HTTP_PORT, 'video', VIDEO_QUERIES);

    log('smoke', 'pausing briefly before the image pair to stay well under any NASA API rate window...');
    await sleep(8000);

    log('smoke', 'searching and importing an image pair (Commons + NASA)...');
    const imagePair = await findAndImportPair(HTTP_PORT, 'image', IMAGE_QUERIES);

    log('smoke', 'verifying imported files on disk with ffprobe...');
    const verifications = {
      commonsVideo: await verifyImport(mediaRoot, toolchainEnv, videoPair.commons, 'video'),
      nasaVideo: await verifyImport(mediaRoot, toolchainEnv, videoPair.nasa, 'video'),
      commonsImage: await verifyImport(mediaRoot, toolchainEnv, imagePair.commons, 'image'),
      nasaImage: await verifyImport(mediaRoot, toolchainEnv, imagePair.nasa, 'image'),
    };

    const credits = await readCredits(mediaRoot);
    if (credits.length !== 4) {
      throw new Error(`expected exactly 4 credit entries, found ${credits.length}`);
    }
    const kinds = credits.map((entry) => entry.kind).sort();
    if (JSON.stringify(kinds) !== JSON.stringify(['image', 'image', 'video', 'video'])) {
      throw new Error(`expected credits kinds [image,image,video,video], got ${JSON.stringify(kinds)}`);
    }

    const imageUsedForViewing = imagePair.commons.import.path;

    log('smoke', `running the real Claude CLI (model haiku) with view_images on ${imageUsedForViewing}...`);
    const claudeResult = await runClaudeCliViewImages(imageUsedForViewing);
    if (!claudeResult.hasImageBlock) {
      throw new Error(
        `the Claude CLI stream-json tool_result for view_images did not carry an image block: ${JSON.stringify(claudeResult.toolResultContentTypes)}`,
      );
    }
    log('smoke', `Claude CLI: view_images called=${claudeResult.viewImagesCalled}, image block=${claudeResult.hasImageBlock}`);

    log('smoke', `running the OpenRouter runtime with view_images on ${imageUsedForViewing}...`);
    const openRouterResult = await runOpenRouterViewImages(imageUsedForViewing, openRouterApiKey);
    if (!openRouterResult.imagePayloadSeen) {
      throw new Error('no image payload was found in the OpenRouter request captured for view_images');
    }
    log(
      'smoke',
      `OpenRouter: model=${openRouterResult.modelId}, image payload seen=${openRouterResult.imagePayloadSeen}, cost=${String(openRouterResult.costUsd)}`,
    );

    const totalCostUsd = openRouterResult.costUsd ?? 0;
    if (totalCostUsd > BUDGET_CAP_USD) {
      throw new Error(`budget exceeded: observed US$${totalCostUsd} > cap US$${BUDGET_CAP_USD}`);
    }

    const artifactPaths = await collectPreviewArtifacts(mediaRoot);

    const report = renderReport({
      videoPair,
      imagePair,
      verifications,
      credits,
      claudeResult,
      openRouterResult,
      imageUsedForViewing,
      artifactPaths: artifactPaths.map((path) => path.slice(REPO_ROOT.length + 1)),
      totalCostUsd,
    });
    assertNoKeyLeak(report, 'the generated report');
    await writeFile(REPORT_PATH, report, 'utf8');
    log('smoke', `report written to ${REPORT_PATH}`);
  } finally {
    await stopRenderApi(child);
    await rm(mediaRootBase, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[smoke] FAILED: ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
