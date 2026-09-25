import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..', '..');
const REPORT_PATH = join(HERE, 'patch-timeline-smoke.md');

const SOURCE_PROJECT_SLUG = 'display-ads-crear-grupo';
const HTTP_HOST = '127.0.0.1';
const HTTP_PORT = 4601;
const SERVER_READY_TIMEOUT_MS = 20_000;
const CLAUDE_CLI_TIMEOUT_MS = 120_000;
const CUTOFF_HOUR_UTC = 23;
const CUTOFF_MINUTE_UTC = 40;

const KEYCHAIN_SERVICE_ENV_VAR = 'RENDER_API_KEYCHAIN_SERVICE';

const TOOLCHAIN_ENV_NAMES = [
  'FFMPEG_PATH',
  'FFPROBE_PATH',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
  'TTS_CLI_PATH',
  'TTS_VOICES_DIR',
];

const REQUESTED_LOGO_POSITION = 'bottom-left';
const REQUESTED_LOGO_OPACITY = 0.4;

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

async function readTimeline(mediaRoot) {
  const raw = await readFile(join(mediaRoot, SOURCE_PROJECT_SLUG, 'work', 'timeline.json'), 'utf8');
  return JSON.parse(raw);
}

function captionWordTexts(timeline) {
  return timeline.tracks.captions.flatMap((clip) => clip.words.map((word) => word.text));
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

async function runClaudeCliMoveLogo() {
  const cwd = await mkdtemp(join(tmpdir(), 'vm-patch-timeline-smoke-claude-cwd-'));
  const apiUrl = `http://${HTTP_HOST}:${HTTP_PORT}`;
  const mcpConfig = buildStudioMcpConfigJson({ apiUrl, project: SOURCE_PROJECT_SLUG, model: 'haiku' });
  const args = [
    '--print',
    'Move the logo overlay to the bottom-left corner of the video, at 40% opacity. Do not change ' +
      'anything else about the timeline: not the captions, not the voice, not any other section.',
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

  const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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

  const toolUses = [];
  for (const event of events) {
    if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (block.type === 'tool_use') {
          toolUses.push({ id: block.id, name: block.name, input: block.input });
        }
      }
    }
  }

  const toolResultsById = new Map();
  for (const event of events) {
    if (event.type === 'user' && event.message && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (block.type === 'tool_result') {
          toolResultsById.set(block.tool_use_id, block);
        }
      }
    }
  }

  const resultEvent = events.find((event) => event.type === 'result');
  const finalText = typeof resultEvent?.result === 'string' ? resultEvent.result : '';

  return {
    toolUses: toolUses.map((use) => ({
      name: use.name,
      input: use.input,
      isError: toolResultsById.get(use.id)?.is_error === true,
    })),
    finalText,
  };
}

function renderReport({ before, after, claudeResult, logoOk, captionsOk, toolUsed }) {
  const lines = [
    '# patch_timeline real smoke — move the logo without touching captions',
    '',
    `Date: ${new Date().toISOString()}`,
    `render-api port: ${HTTP_PORT}`,
    `Project: ${SOURCE_PROJECT_SLUG} (temp clone, discarded after the run)`,
    '',
    '## Request to the real studio MCP server (claude CLI, model haiku)',
    '',
    '> Move the logo overlay to the bottom-left corner of the video, at 40% opacity. Do not change',
    '> anything else about the timeline: not the captions, not the voice, not any other section.',
    '',
    '## Tool calls made by the model',
    '',
    ...claudeResult.toolUses.map(
      (use) => `- \`${use.name}\`${use.isError ? ' (returned an error)' : ''}: ${JSON.stringify(use.input)}`,
    ),
    '',
    `Tool used for the change: **${toolUsed}**`,
    '',
    `## Model's answer`,
    '',
    `> ${claudeResult.finalText.replace(/\n/gu, '\n> ')}`,
    '',
    '## Timeline logo — before / after',
    '',
    '```json',
    JSON.stringify(before.logo, null, 2),
    '```',
    '',
    '```json',
    JSON.stringify(after.logo, null, 2),
    '```',
    '',
    `- Logo moved to \`${REQUESTED_LOGO_POSITION}\` at opacity \`${REQUESTED_LOGO_OPACITY}\`: **${logoOk ? 'PASSED' : 'FAILED'}**`,
    '',
    '## Caption words — before / after',
    '',
    `- Caption word count before: ${before.words.length}`,
    `- Caption word count after: ${after.words.length}`,
    `- Every caption word identical, including diacritics: **${captionsOk ? 'PASSED' : 'FAILED'}**`,
    '',
    ...(captionsOk
      ? []
      : [
          '### First differing words',
          '',
          '```json',
          JSON.stringify({ before: before.words.slice(0, 20), after: after.words.slice(0, 20) }, null, 2),
          '```',
          '',
        ]),
  ];
  return lines.join('\n');
}

async function main() {
  if (pastCutoff()) {
    log('smoke', `it is already past ${CUTOFF_HOUR_UTC}:${CUTOFF_MINUTE_UTC} UTC — pausing before starting any heavy work`);
    return;
  }

  const toolchainEnv = await loadToolchainEnv();
  const keychainService = `Video Maker Smoke ${process.pid}`;
  const mediaRootBase = await mkdtemp(join(tmpdir(), 'vm-patch-timeline-smoke-'));

  let child;
  try {
    const mediaRoot = mediaRootBase;
    await cloneProject(mediaRoot);

    const before = await readTimeline(mediaRoot);
    const beforeWords = captionWordTexts(before);

    child = spawnRenderApi(HTTP_PORT, mediaRoot, keychainService, toolchainEnv);
    await waitForHttp(`http://${HTTP_HOST}:${HTTP_PORT}/health`, SERVER_READY_TIMEOUT_MS);
    log('smoke', `render-api ready on port ${HTTP_PORT}, media root ${mediaRoot}`);

    log('smoke', 'asking the real studio MCP server (claude CLI, model haiku) to move the logo...');
    const claudeResult = await runClaudeCliMoveLogo();
    const timelineToolUses = claudeResult.toolUses.filter((use) =>
      ['put_timeline', 'patch_timeline'].includes(use.name.replace('mcp__studio__', '')),
    );
    if (timelineToolUses.length === 0) {
      throw new Error('the model never called put_timeline or patch_timeline');
    }
    const toolUsed = timelineToolUses[timelineToolUses.length - 1].name.replace('mcp__studio__', '');
    log('smoke', `model used: ${toolUsed}`);

    const after = await readTimeline(mediaRoot);
    const afterWords = captionWordTexts(after);

    const logoOk =
      after.logo?.position === REQUESTED_LOGO_POSITION && Math.abs((after.logo?.opacity ?? -1) - REQUESTED_LOGO_OPACITY) < 1e-9;
    const captionsOk =
      beforeWords.length === afterWords.length && beforeWords.every((word, index) => word === afterWords[index]);

    const report = renderReport({
      before: { logo: before.logo, words: beforeWords },
      after: { logo: after.logo, words: afterWords },
      claudeResult,
      logoOk,
      captionsOk,
      toolUsed,
    });
    await writeFile(REPORT_PATH, report, 'utf8');
    log('smoke', `report written to ${REPORT_PATH}`);

    if (!logoOk) {
      throw new Error(`logo was not moved as requested: ${JSON.stringify(after.logo)}`);
    }
    if (!captionsOk) {
      throw new Error('caption words changed — patch_timeline must never touch captions');
    }

    log('smoke', 'PASSED: logo moved, every caption word identical (including diacritics)');
  } finally {
    await stopRenderApi(child);
    await rm(mediaRootBase, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[smoke] FAILED: ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
