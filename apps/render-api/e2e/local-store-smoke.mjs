import { execFileSync, execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, join, relative } from 'node:path';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const MEDIA_ROOT = join(REPO_ROOT, 'media');
const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-02/artifacts',
);

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function loadRootEnv(names) {
  let raw = '';
  try {
    raw = await readFile(join(REPO_ROOT, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u.exec(line);
    if (match === null) {
      continue;
    }
    const [, name, value] = match;
    if (!names.includes(name) || process.env[name] !== undefined) {
      continue;
    }
    process.env[name] = value.replace(/^['"]|['"]$/gu, '');
  }
}

function spawnServer(label, port, mediaRoot, extraEnv = {}) {
  const child = spawn(
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        RENDER_API_PORT: String(port),
        RENDER_API_HOST: '127.0.0.1',
        RENDER_API_MEDIA_ROOT: mediaRoot,
        RENDER_API_URL: `http://127.0.0.1:${port}`,
        SWC_NODE_PROJECT: 'tsconfig.base.json',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const lines = [];
  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
    lines.push(String(chunk));
  });
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.lines = lines;
  return child;
}

async function waitForHttp(url, timeoutMs) {
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

async function stopServerGracefully(child) {
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(resolve, 4000);
  });
}

async function killServerHard(child) {
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGKILL');
    setTimeout(resolve, 1000);
  });
}

async function apiJson(port, path, init) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function findProcesses(pattern) {
  try {
    return execSync(`pgrep -fl '${pattern}' || true`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '');
  } catch {
    return [];
  }
}

function killProcesses(lines) {
  let killed = 0;
  for (const line of lines) {
    const pid = Number(line.trim().split(/\s+/u)[0]);
    if (!Number.isInteger(pid)) {
      continue;
    }
    try {
      process.kill(pid, 'SIGKILL');
      killed += 1;
    } catch {
      // already gone
    }
  }
  return killed;
}

async function sha256File(path) {
  const buffer = await readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

function readRowCounts(dbPath) {
  const tables = [
    'projects',
    'folders',
    'categories',
    'placements',
    'producer_sessions',
    'producer_messages',
    'jobs',
    'settings',
  ];
  const counts = {};
  for (const table of tables) {
    counts[table] = Number(
      execFileSync('sqlite3', [dbPath, `SELECT COUNT(*) FROM ${table};`], { encoding: 'utf8' }).trim(),
    );
  }
  return counts;
}

function parseRational(value) {
  const [num, den] = value.split('/').map(Number);
  return den === undefined || den === 0 ? num : num / den;
}

function probeVideoStream(mp4Path) {
  const raw = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-count_frames',
      '-show_entries',
      'stream=nb_read_frames,nb_frames,width,height,r_frame_rate,codec_name',
      '-of',
      'json',
      mp4Path,
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(raw).streams[0] ?? null;
}

async function assert(condition, message, evidence) {
  const entry = { message, ok: Boolean(condition) };
  evidence.checks.push(entry);
  log('assert', `${entry.ok ? 'OK  ' : 'FAIL'} ${message}`);
  if (!condition) {
    throw new Error(`assertion failed: ${message}`);
  }
}

function newEvidence(name) {
  return { case: name, startedAt: new Date().toISOString(), checks: [] };
}

async function writeEvidence(name, evidence) {
  evidence.finishedAt = new Date().toISOString();
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const path = join(ARTIFACTS_DIR, `local-store-smoke-${name}.json`);
  await writeFile(path, JSON.stringify(evidence, null, 2), 'utf8');
  log(name, `evidence written to ${relative(REPO_ROOT, path)}`);
  return path;
}

// ---------------------------------------------------------------------------
// case: import
// ---------------------------------------------------------------------------

async function runImportCase(evidence) {
  const name = 'import';
  const port = 48601;

  const tempRoot = await mkdtemp(join(tmpdir(), 'local-store-smoke-import-'));
  const tempMedia = join(tempRoot, 'media');
  log(name, `APFS-cloning media/ into ${tempMedia}`);
  execFileSync('cp', ['-Rc', MEDIA_ROOT, tempMedia]);

  let server = null;
  try {
    const trackedFiles = execSync(
      `find "${tempMedia}" \\( -name organization.json -o -name conversation.json -o -name session.json \\)`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter((line) => line !== '');
    evidence.trackedFileCount = trackedFiles.length;
    log(name, `tracking ${trackedFiles.length} organization/conversation/session files`);

    const hashesBefore = {};
    for (const file of trackedFiles) {
      hashesBefore[file] = await sha256File(file);
    }

    const projectDirs = (await readdir(tempMedia, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && PROJECT_SLUG_PATTERN.test(entry.name))
      .map((entry) => entry.name);
    evidence.projectDirCount = projectDirs.length;
    log(name, `${projectDirs.length} project directories on disk`);

    server = spawnServer('import:run1', port, tempMedia);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);
    evidence.importReportRun1 = server.lines.find((line) => line.includes('legacy-media-import'))?.trim() ?? null;

    const countsRun1 = readRowCounts(join(tempMedia, '.studio', 'studio.db'));
    evidence.countsRun1 = countsRun1;

    const projectsRun1 = (await apiJson(port, '/projects')).body;
    await assert(
      Array.isArray(projectsRun1) && projectsRun1.length === projectDirs.length,
      `GET /projects returns ${projectDirs.length} entries (one per project directory)`,
      evidence,
    );

    const conversationFile = trackedFiles.find((file) => file.endsWith('/conversation.json'));
    if (conversationFile !== undefined) {
      const slug = basename(dirname(dirname(dirname(conversationFile))));
      const sourceDocument = JSON.parse(await readFile(conversationFile, 'utf8'));
      const apiBody = (await apiJson(port, `/projects/${slug}/producer`)).body;
      evidence.knownConversationSlug = slug;
      await assert(
        stableStringify(apiBody.messages) === stableStringify(sourceDocument.messages),
        `GET /projects/${slug}/producer.messages equals the source conversation.json`,
        evidence,
      );
    } else {
      log(name, 'no conversation.json found under media/ — skipping the known-conversation check');
    }

    await stopServerGracefully(server);
    server = null;

    server = spawnServer('import:run2', port, tempMedia);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);
    evidence.importReportRun2 = server.lines.find((line) => line.includes('legacy-media-import'))?.trim() ?? null;

    const countsRun2 = readRowCounts(join(tempMedia, '.studio', 'studio.db'));
    evidence.countsRun2 = countsRun2;

    await assert(
      JSON.stringify(countsRun1) === JSON.stringify(countsRun2),
      'table row counts are identical across the two runs',
      evidence,
    );

    await stopServerGracefully(server);
    server = null;

    const hashesAfter = {};
    for (const file of trackedFiles) {
      hashesAfter[file] = await sha256File(file);
    }
    const changed = trackedFiles.filter((file) => hashesBefore[file] !== hashesAfter[file]);
    evidence.changedSourceFiles = changed;
    await assert(changed.length === 0, 'every source organization/conversation/session file is byte-identical after two runs', evidence);
  } finally {
    if (server !== null) {
      await killServerHard(server);
    }
    await rm(tempRoot, { recursive: true, force: true });
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// case: interrupted-render
// ---------------------------------------------------------------------------

async function buildSyntheticProject(mediaRoot, slug) {
  const projectRoot = join(mediaRoot, slug);
  for (const sub of ['raw/aroll', 'raw/broll', 'raw/images', 'raw/audio', 'raw/voice', 'raw/logo', 'work', 'out']) {
    await mkdir(join(projectRoot, sub), { recursive: true });
  }
  const clipPath = join(projectRoot, 'raw', 'aroll', 'clip.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1080x1920:rate=30:duration=8',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=8',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    clipPath,
  ]);
  return projectRoot;
}

async function pollJob(port, jobId, deadlineMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < deadlineMs) {
    const { body } = await apiJson(port, `/jobs/${jobId}`);
    if (body !== null && body.state !== 'running' && body.state !== 'queued' && body.state !== 'canceling') {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`job ${jobId} did not settle within ${deadlineMs}ms`);
}

async function runInterruptedRenderCase(evidence) {
  const name = 'interrupted-render';
  const port = 48602;
  const slug = 'smoke-interrupted';

  const tempRoot = await mkdtemp(join(tmpdir(), 'local-store-smoke-render-'));
  const tempMedia = join(tempRoot, 'media');
  await mkdir(tempMedia, { recursive: true });

  let server = null;
  try {
    log(name, 'building a synthetic 8s clip with video and audio (ffmpeg lavfi testsrc+sine)');
    await buildSyntheticProject(tempMedia, slug);

    server = spawnServer(`${name}:run1`, port, tempMedia);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);

    const montage = (await apiJson(port, `/projects/${slug}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'montage' }),
    })).body;
    const montageResult = await pollJob(port, montage.id, 60000);
    await assert(montageResult.state === 'succeeded', 'the montage job that builds the timeline succeeds', evidence);

    const render = (await apiJson(port, `/projects/${slug}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'render' }),
    })).body;
    evidence.originalJobId = render.id;
    log(name, `render job ${render.id} started, waiting for progress > 0 in the database`);

    const dbPath = join(tempMedia, '.studio', 'studio.db');
    const progressDeadline = Date.now() + 30000;
    let progressRow = null;
    while (Date.now() < progressDeadline) {
      const raw = execFileSync('sqlite3', [dbPath, `SELECT progress FROM jobs WHERE id='${render.id}';`], {
        encoding: 'utf8',
      }).trim();
      if (raw !== '' && raw !== 'null') {
        const progress = JSON.parse(raw);
        if (typeof progress.renderedFrames === 'number' && progress.renderedFrames > 0) {
          progressRow = progress;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    evidence.progressBeforeKill = progressRow;
    await assert(
      progressRow !== null && progressRow.renderedFrames > 0,
      'progress.renderedFrames > 0 is visible directly in the SQLite row before the kill',
      evidence,
    );

    log(name, `killing the server (pid ${server.pid}) with SIGKILL mid-render`);
    await killServerHard(server);
    server = null;
    await new Promise((resolve) => setTimeout(resolve, 500));

    const orphans = findProcesses('chrome-headless-shell|ffmpeg');
    evidence.orphanProcessesFound = orphans.length;
    evidence.orphanProcessLines = orphans;
    if (orphans.length > 0) {
      log(name, `found ${orphans.length} orphaned process(es), killing them`);
      const killedCount = killProcesses(orphans);
      evidence.orphanProcessesKilled = killedCount;
    } else {
      evidence.orphanProcessesKilled = 0;
    }

    server = spawnServer(`${name}:run2`, port, tempMedia);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);

    const interrupted = (await apiJson(port, `/jobs/${render.id}`)).body;
    evidence.interruptedJob = interrupted;
    await assert(interrupted.state === 'failed', 'the job is reported as failed after the restart', evidence);
    await assert(
      interrupted.error?.code === 'JOB_INTERRUPTED',
      'the job error.code is JOB_INTERRUPTED after the restart',
      evidence,
    );

    const retryResponse = await apiJson(port, `/jobs/${render.id}/retry`, { method: 'POST' });
    await assert(retryResponse.status === 202, 'POST /jobs/:id/retry answers 202', evidence);
    const retried = retryResponse.body;
    evidence.retriedJobId = retried.id;

    const settled = await pollJob(port, retried.id, 60000);
    evidence.retriedJobResult = settled;
    await assert(settled.state === 'succeeded', 'the retried job succeeds', evidence);

    const mp4Path = join(tempMedia, slug, 'out', `${retried.id}.mp4`);
    const stream = probeVideoStream(mp4Path);
    evidence.ffprobe = stream;
    const nbFrames = Number(stream?.nb_read_frames ?? stream?.nb_frames);
    evidence.reportDurationInFrames = settled.report?.deliverable?.durationInFrames;
    await assert(
      nbFrames === settled.report?.deliverable?.durationInFrames,
      `ffprobe nb_frames (${nbFrames}) equals report.deliverable.durationInFrames (${settled.report?.deliverable?.durationInFrames})`,
      evidence,
    );

    await stopServerGracefully(server);
    server = null;
  } finally {
    if (server !== null) {
      await killServerHard(server);
    }
    await rm(tempRoot, { recursive: true, force: true });
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// case: producer-restart
// ---------------------------------------------------------------------------

async function postProducerMessage(port, slug, text) {
  const { status, body } = await apiJson(port, `/projects/${slug}/producer/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (status !== 202) {
    throw new Error(`POST /producer/messages -> ${status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function followProducerTurn(port, slug, turnId, deadlineMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < deadlineMs) {
    const { body } = await apiJson(port, `/projects/${slug}/producer/turns/${turnId}`);
    if (body !== null && body.status !== 'running') {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`producer turn ${turnId} did not settle within ${deadlineMs}ms`);
}

async function runProducerRestartCase(evidence) {
  const name = 'producer-restart';
  const port = 48603;
  const slug = 'display-ads-analiticas';

  const heavy = findProcesses("claude -p");
  if (heavy.length > 0) {
    throw new Error(`refusing to start: a stray "claude -p" process from a previous run is still alive:\n${heavy.join('\n')}`);
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'local-store-smoke-producer-'));
  const tempMedia = join(tempRoot, 'media');
  const tempCliCwd = await mkdtemp(join(tmpdir(), 'local-store-smoke-producer-cwd-'));
  await mkdir(tempMedia, { recursive: true });

  log(name, `APFS-cloning media/${slug} into the temp media root`);
  execFileSync('cp', ['-Rc', join(MEDIA_ROOT, slug), join(tempMedia, slug)]);

  let server = null;
  try {
    const extraEnv = { PRODUCER_MODEL: 'haiku', CLAUDE_CLI_CWD: tempCliCwd };

    server = spawnServer(`${name}:run1`, port, tempMedia, extraEnv);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);

    log(name, 'first producer turn');
    const first = await postProducerMessage(
      port,
      slug,
      'Hola, decime en una línea qué material tiene este proyecto.',
    );
    const firstTurn = await followProducerTurn(port, slug, first.turnId, 240000);
    evidence.firstTurn = { status: firstTurn.status, assistantMessage: firstTurn.assistantMessage };
    await assert(firstTurn.status === 'succeeded', 'the first producer turn succeeds', evidence);

    await stopServerGracefully(server);
    server = null;

    server = spawnServer(`${name}:run2`, port, tempMedia, extraEnv);
    await waitForHttp(`http://127.0.0.1:${port}/health`, 20000);

    log(name, 'second producer turn, after the restart, asking the model to recall the first message');
    const second = await postProducerMessage(port, slug, '¿Qué te pregunté recién?');
    const secondTurn = await followProducerTurn(port, slug, second.turnId, 240000);
    evidence.secondTurn = { status: secondTurn.status, assistantMessage: secondTurn.assistantMessage };
    await assert(secondTurn.status === 'succeeded', 'the second producer turn succeeds after the restart', evidence);

    const conversation = (await apiJson(port, `/projects/${slug}/producer`)).body;
    evidence.conversation = conversation.messages.map((message) => ({ role: message.role, text: message.text }));
    await assert(
      conversation.messages.length === 4,
      'GET .../producer lists both exchanges (4 messages) in order',
      evidence,
    );
    await assert(
      conversation.messages[0].role === 'user' &&
        conversation.messages[1].role === 'assistant' &&
        conversation.messages[2].role === 'user' &&
        conversation.messages[3].role === 'assistant',
      'the four messages alternate user/assistant in the order they were sent',
      evidence,
    );

    const recallText = String(conversation.messages[3].text).toLowerCase();
    evidence.recalledFirstQuestion =
      recallText.includes('material') || recallText.includes('proyecto') || recallText.includes('línea');
    await assert(
      evidence.recalledFirstQuestion,
      'the second answer references the first question (session survived the restart)',
      evidence,
    );

    const conversationJsonExists = await readdir(join(tempMedia, slug, 'work', 'producer')).catch(() => []);
    evidence.workProducerFiles = conversationJsonExists;
    await assert(
      !conversationJsonExists.includes('conversation.json') && !conversationJsonExists.includes('session.json'),
      'no conversation.json or session.json was written to the project directory',
      evidence,
    );

    await stopServerGracefully(server);
    server = null;
  } finally {
    if (server !== null) {
      await killServerHard(server);
    }
    execSync("pkill -f 'claude -p' || true");
    await rm(tempRoot, { recursive: true, force: true });
    await rm(tempCliCwd, { recursive: true, force: true });
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// dispatcher
// ---------------------------------------------------------------------------

const CASES = {
  import: runImportCase,
  'interrupted-render': runInterruptedRenderCase,
  'producer-restart': runProducerRestartCase,
};

async function main() {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--case='));
  const caseName = arg?.replace('--case=', '');

  if (caseName === undefined || !(caseName in CASES)) {
    console.error(`usage: node local-store-smoke.mjs --case=<${Object.keys(CASES).join('|')}>`);
    console.error('note: --case=web-interrupted is not implemented (no Playwright in this repo, see plan.md).');
    process.exitCode = 1;
    return;
  }

  await loadRootEnv(['FFMPEG_PATH', 'FFPROBE_PATH', 'WHISPER_CPP_PATH', 'WHISPER_MODEL_PATH']);

  const evidence = newEvidence(caseName);
  try {
    await CASES[caseName](evidence);
    evidence.ok = evidence.checks.every((check) => check.ok);
  } catch (cause) {
    console.error(`\n[failed:${caseName}] ${cause.stack ?? cause.message}`);
    evidence.ok = false;
    evidence.error = cause.message;
    await writeEvidence(caseName, evidence);
    process.exitCode = 1;
    return;
  }

  await writeEvidence(caseName, evidence);
  console.log(`\n[${caseName}] ${evidence.ok ? 'PASSED' : 'FAILED'} (${evidence.checks.length} checks)`);
  if (!evidence.ok) {
    process.exitCode = 1;
  }
}

await main();
