import { createServer, request as httpRequest } from 'node:http';
import { execFileSync, execSync, spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESKTOP_ROOT = join(REPO_ROOT, 'apps', 'desktop');
const VENDOR_CACHE_MODELS_DIR = join(homedir(), '.cache', 'video-maker-vendor', 'models');
const MIRROR_PORT = Number(process.env.PACKAGED_SMOKE_MIRROR_PORT ?? '8991');
const DEBUG_PORT = Number(process.env.PACKAGED_SMOKE_DEBUG_PORT ?? '9700');

const FORWARD_CHIP_PATTERN = /dale|avanz|proces|renderiz|confirm|produc|adelante|segu[ií]/iu;
const TERMINAL_JOB_STATES = new Set(['succeeded', 'failed', 'canceled']);

// mirrors CASES.tutorial in apps/render-api/e2e/producer-mcp-smoke.mjs — keep both in sync
const TUTORIAL = {
  sourceSlug: 'display-ads-analiticas',
  firstText:
    'Quiero un tutorial de esta grabación de pantalla, para YouTube. Receta Tutorial: narración ' +
    'con voz generada (Daniela, español rioplatense) sincronizada con lo que pasa en pantalla ' +
    'siguiendo mi tabla de escenas y tiempos, subtítulos clásicos abajo, música libre suave de ' +
    'fondo con crédito, el logo transparente abajo a la derecha al 50 %, y una placa de inicio y ' +
    'otra de cierre de 2 segundos con fondo blanco y el logo. El guion cierra siempre con una ' +
    'despedida: si mi tabla no la trae, agregala vos como última línea, del estilo ' +
    '«¡Gracias por ver este tutorial! Nos vemos en el próximo.» Guion con tiempos: usá el que ya ' +
    'está en el proyecto (work/producer/script.txt). Cuando confirmemos el guion, producí y renderizá.',
  fallbacks: [
    'Dale, avanzá con tu propuesta: confirmo el guion, producí todo y renderizá.',
    'Sí, esa elección está bien, seguí.',
  ],
  maxTurns: 4,
  turnDeadlineMs: 900_000,
};

function rawHttpRequest({ port, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function finderLaunchEnv(userDataDir) {
  return {
    HOME: homedir(),
    PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    USER: userInfo().username,
    LOGNAME: userInfo().username,
    TMPDIR: tmpdir(),
    VIDEO_MAKER_USER_DATA: userDataDir,
  };
}

function log(step, message) {
  process.stdout.write(`[${step}] ${message}\n`);
}

function sh(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function readDesktopVersion() {
  return JSON.parse(readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf8')).version;
}

function startMirrorServer() {
  const server = createServer((req, res) => {
    const fileName = decodeURIComponent((req.url ?? '/').replace(/^\//u, ''));
    const filePath = join(VENDOR_CACHE_MODELS_DIR, fileName);
    let size;
    try {
      size = statSync(filePath).size;
    } catch {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const range = req.headers.range;
    if (range === undefined) {
      res.writeHead(200, { 'content-length': String(size), 'accept-ranges': 'bytes' });
      createReadStream(filePath).pipe(res);
      return;
    }
    const start = Number(/bytes=(\d+)-/u.exec(range)?.[1] ?? '0');
    res.writeHead(206, {
      'content-range': `bytes ${start}-${size - 1}/${size}`,
      'content-length': String(size - start),
      'accept-ranges': 'bytes',
    });
    createReadStream(filePath, { start }).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(MIRROR_PORT, '127.0.0.1', () => resolve(server));
  });
}

function patchManifestToMirror(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mirror = `http://127.0.0.1:${MIRROR_PORT}/`;
  manifest.models.whisper.url = `${mirror}ggml-large-v3-turbo-q5_0.bin`;
  manifest.models.chromeHeadlessShell.url = `${mirror}chrome-headless-shell-mac-arm64.zip`;
  for (const voice of manifest.models.voices) {
    voice.url = mirror + voice.url.split('/').pop();
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function mountAndCopyApp(dmgPath, destAppsDir) {
  execFileSync('xattr', ['-w', 'com.apple.quarantine', `0081;${Math.floor(Date.now() / 1000).toString(16)};Safari;`, dmgPath]);
  const mountPoint = mkdtempSync(join(tmpdir(), 'packaged-smoke-mnt-'));
  execFileSync('hdiutil', ['attach', dmgPath, '-mountpoint', mountPoint, '-nobrowse']);
  try {
    mkdirSync(destAppsDir, { recursive: true });
    execFileSync('cp', ['-R', join(mountPoint, 'Video Maker.app'), destAppsDir]);
  } finally {
    execFileSync('hdiutil', ['detach', mountPoint]);
    rmSync(mountPoint, { recursive: true, force: true });
  }
  const appPath = join(destAppsDir, 'Video Maker.app');
  const spctl = spawnSyncResult('spctl', ['-a', '-vv', '--type', 'execute', appPath]);
  const dmgSpctl = spawnSyncResult('spctl', ['-a', '-vv', dmgPath]);
  execFileSync('xattr', ['-d', 'com.apple.quarantine', appPath]);
  return { appPath, spctlApp: spctl, spctlDmg: dmgSpctl };
}

function spawnSyncResult(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
  }
}

async function waitFor(predicate, { timeoutMs, intervalMs = 1000, label }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) {
      return value;
    }
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for: ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function waitForCdpTarget(port, urlIncludes, timeoutMs) {
  return waitFor(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();
        return targets.find((target) => target.type === 'page' && target.url.includes(urlIncludes)) ?? null;
      } catch {
        return null;
      }
    },
    { timeoutMs, intervalMs: 1000, label: `CDP target containing "${urlIncludes}"` },
  );
}

class CdpSession {
  constructor(webSocketDebuggerUrl) {
    this.ws = new WebSocket(webSocketDebuggerUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const resolver = this.pending.get(message.id);
      if (resolver !== undefined) {
        this.pending.delete(message.id);
        resolver(message);
      }
    });
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', reject);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.nextId;
      this.nextId += 1;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    await this.ready();
    await this.send('Runtime.enable');
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.result.exceptionDetails) {
      throw new Error(`CDP evaluate failed: ${JSON.stringify(result.result.exceptionDetails)}`);
    }
    return result.result.result.value;
  }

  close() {
    this.ws.close();
  }
}

async function driveSetupWindow(cdp, expectedInstalledIds) {
  const initial = JSON.parse(await cdp.evaluate('JSON.stringify(window.setupApi ? "ready" : "missing")'));
  if (initial === 'missing') {
    throw new Error('setup renderer did not expose window.setupApi');
  }

  await waitFor(
    async () => {
      const raw = await cdp.evaluate(
        "JSON.stringify({disabled: document.getElementById('downloads-continue').disabled, rows: document.querySelectorAll('.item-row').length})",
      );
      const state = JSON.parse(raw);
      return state.rows === expectedInstalledIds && !state.disabled ? state : null;
    },
    { timeoutMs: 120_000, intervalMs: 2000, label: 'setup downloads to finish' },
  );

  await cdp.evaluate("document.getElementById('downloads-continue').click(); true");
  await waitFor(
    async () =>
      JSON.parse(
        await cdp.evaluate("document.getElementById('step-folder').classList.contains('visible')"),
      ),
    { timeoutMs: 10_000, intervalMs: 500, label: 'folder step visible' },
  );

  const defaultFolder = await cdp.evaluate("document.getElementById('folder-path').textContent");
  await cdp.evaluate("document.getElementById('folder-continue').click(); true");
  await waitFor(
    async () =>
      JSON.parse(await cdp.evaluate("document.getElementById('step-claude').classList.contains('visible')")),
    { timeoutMs: 10_000, intervalMs: 500, label: 'claude step visible' },
  );

  const claudeStatus = await waitFor(
    async () => {
      const raw = await cdp.evaluate(
        "JSON.stringify({badge: document.getElementById('claude-status-badge').textContent, finishDisplay: document.getElementById('claude-finish').style.display, detail: document.getElementById('claude-detail').textContent})",
      );
      const status = JSON.parse(raw);
      return status.finishDisplay === 'inline-block' ? status : null;
    },
    { timeoutMs: 15_000, intervalMs: 1000, label: 'claude check to resolve' },
  );

  await cdp.evaluate("document.getElementById('claude-finish').click(); true");
  return { defaultFolder, claudeStatus };
}

async function driveStudioProjectList(debugPort, renderApiPort, slug) {
  const target = await waitForCdpTarget(debugPort, `127.0.0.1:${renderApiPort}`, 60_000);
  const cdp = new CdpSession(target.webSocketDebuggerUrl);
  const hasCard = await waitFor(
    async () =>
      JSON.parse(
        await cdp.evaluate(
          `document.querySelector('[data-testid="video-card"][data-video="${slug}"]') !== null`,
        ),
      ),
    { timeoutMs: 30_000, intervalMs: 1000, label: 'imported project card in the list' },
  );
  return { cdp, hasCard };
}

async function openProducerPage(cdp, slug) {
  await cdp.evaluate(
    `document.querySelector('[data-testid="video-card"][data-video="${slug}"] a').click(); true`,
  );
  await waitFor(
    async () => JSON.parse(await cdp.evaluate("document.querySelector('[data-testid=\"producer-composer\"]') !== null")),
    { timeoutMs: 15_000, intervalMs: 500, label: 'producer page loaded' },
  );
}

async function sendComposerText(cdp, text) {
  const escaped = JSON.stringify(text);
  await cdp.evaluate(`
    (function () {
      const textarea = document.querySelector('[data-testid="producer-composer"] textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, ${escaped});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `);
  await cdp.evaluate(
    "document.querySelector('[data-testid=\"producer-composer\"] button').click(); true",
  );
}

async function waitForTurnSettled(cdp, deadlineMs) {
  return waitFor(
    async () => {
      const raw = await cdp.evaluate(`
        (function () {
          const activity = document.querySelector('[data-testid="producer-turn-activity"]');
          if (activity === null) return null;
          const status = activity.getAttribute('data-status');
          if (status === 'running') return null;
          const events = Array.from(document.querySelectorAll('[data-testid="producer-turn-events"] li[data-event-type]'));
          const toolCalls = events
            .filter((el) => el.getAttribute('data-event-type') === 'tool')
            .map((el) => el.textContent.split(' · ')[0]);
          const suggestions = Array.from(
            document.querySelectorAll('[data-testid="producer-suggestions"] button'),
          ).map((el) => el.textContent);
          return JSON.stringify({ status, toolCalls, suggestions });
        })()
      `);
      return raw === null ? null : JSON.parse(raw);
    },
    { timeoutMs: deadlineMs, intervalMs: 3000, label: 'producer turn to settle' },
  );
}

async function driveConversation(cdp) {
  const allToolCalls = [];
  let text = TUTORIAL.firstText;
  let fallbackIndex = 0;

  for (let turnIndex = 0; turnIndex < TUTORIAL.maxTurns; turnIndex += 1) {
    log('conversation', `turn ${turnIndex + 1}/${TUTORIAL.maxTurns}`);
    await sendComposerText(cdp, text);
    const settled = await waitForTurnSettled(cdp, TUTORIAL.turnDeadlineMs);
    allToolCalls.push(...settled.toolCalls);
    log('conversation', `turn ${turnIndex + 1} settled: ${settled.status}, tools: ${settled.toolCalls.join(', ')}`);

    if (settled.status !== 'succeeded') {
      return { allToolCalls, lastStatus: settled.status };
    }

    const forward = settled.suggestions.find((chip) => FORWARD_CHIP_PATTERN.test(chip));
    if (forward !== undefined) {
      text = forward;
      continue;
    }
    if (fallbackIndex < TUTORIAL.fallbacks.length) {
      text = TUTORIAL.fallbacks[fallbackIndex];
      fallbackIndex += 1;
      continue;
    }
    return { allToolCalls, lastStatus: settled.status };
  }
  return { allToolCalls, lastStatus: 'max-turns-reached' };
}

async function waitForRenderJob(cdp, deadlineMs) {
  return waitFor(
    async () => {
      const raw = await cdp.evaluate(`
        (function () {
          const jobs = Array.from(document.querySelectorAll('[data-testid="producer-jobs"] li[data-job-kind]'));
          const render = jobs.find((el) => el.getAttribute('data-job-kind') === 'render');
          if (render === null || render === undefined) return null;
          return JSON.stringify({ state: render.getAttribute('data-job-state') });
        })()
      `);
      if (raw === null) return null;
      const job = JSON.parse(raw);
      return ['succeeded', 'failed', 'canceled'].includes(job.state) ? job : null;
    },
    { timeoutMs: deadlineMs, intervalMs: 3000, label: 'render job to finish' },
  );
}

function findLatestMp4(outDir) {
  const files = readdirSync(outDir)
    .filter((name) => name.endsWith('.mp4'))
    .map((name) => ({ name, path: join(outDir, name), mtime: statSync(join(outDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.path ?? null;
}

function ffprobeVideoStream(mp4Path) {
  const raw = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames,codec_name -of json "${mp4Path}"`,
    { encoding: 'utf8' },
  );
  return JSON.parse(raw).streams[0] ?? null;
}

function renderApiPidUnder(appPid) {
  const tree = sh(`pgrep -P ${appPid} || true`);
  for (const pid of tree.split('\n').filter((line) => line !== '')) {
    const cmd = spawnSyncResult('ps', ['-o', 'command=', '-p', pid]);
    if (cmd.includes('render-api/main.js')) {
      return pid;
    }
  }
  const all = sh("pgrep -f 'render-api/main.js' || true");
  return all.split('\n').find((line) => line !== '') ?? null;
}

function renderApiTokenAndPort(renderApiPid) {
  const env = sh(`ps eww ${renderApiPid}`);
  const token = /RENDER_API_ACCESS_TOKEN=(\S+)/u.exec(env)?.[1] ?? null;
  return token;
}

function processTreeSnapshot(appPid) {
  return sh(`ps -o pid,ppid,rss,command -g $(ps -o pgid= -p ${appPid} | tr -d ' ') 2>/dev/null || true`);
}

function sumRss(psOutput) {
  let total = 0;
  for (const line of psOutput.split('\n').slice(1)) {
    const rss = Number(line.trim().split(/\s+/)[2]);
    if (Number.isFinite(rss)) {
      total += rss;
    }
  }
  return total;
}

async function main() {
  const startedAt = Date.now();
  const version = readDesktopVersion();
  const dmgPath = join(REPO_ROOT, 'dist', 'desktop', `Video-Maker-${version}-arm64.dmg`);
  if (!existsSync(dmgPath)) {
    throw new Error(`dmg not found at ${dmgPath} — run \`pnpm desktop:dist\` first`);
  }

  const workDir = mkdtempSync(join(tmpdir(), 'packaged-app-smoke-'));
  const appsDir = join(workDir, 'MyApplications');
  const userDataDir = join(workDir, 'userData');
  const projectsDir = join(userDataDir, 'projects');

  log('mount', `mounting ${dmgPath}`);
  const { appPath, spctlApp, spctlDmg } = mountAndCopyApp(dmgPath, appsDir);

  patchManifestToMirror(join(appPath, 'Contents', 'Resources', 'manifest.json'));
  const mirror = await startMirrorServer();

  mkdirSync(projectsDir, { recursive: true });
  execFileSync('cp', ['-Rc', join(REPO_ROOT, 'media', TUTORIAL.sourceSlug), join(projectsDir, TUTORIAL.sourceSlug)]);

  const appBinary = join(appPath, 'Contents', 'MacOS', 'Video Maker');
  const child = spawn(
    appBinary,
    [`--remote-debugging-port=${DEBUG_PORT}`],
    {
      env: finderLaunchEnv(userDataDir),
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: false,
    },
  );

  const setupTarget = await waitForCdpTarget(DEBUG_PORT, 'setup.html', 60_000);
  const setupCdp = new CdpSession(setupTarget.webSocketDebuggerUrl);
  const { defaultFolder, claudeStatus } = await driveSetupWindow(setupCdp, 5);
  setupCdp.close();

  const firstRunElapsedMs = Date.now() - startedAt;
  log('setup', `finished in ${(firstRunElapsedMs / 1000).toFixed(1)}s, folder=${defaultFolder}, claude=${JSON.stringify(claudeStatus)}`);

  const renderApiPid = await waitFor(
    async () => renderApiPidUnder(child.pid),
    { timeoutMs: 30_000, intervalMs: 1000, label: 'render-api process to start' },
  );
  const token = await waitFor(
    async () => renderApiTokenAndPort(renderApiPid),
    { timeoutMs: 10_000, intervalMs: 500, label: 'render-api access token' },
  );
  const port = await waitFor(
    async () => {
      const logPath = join(userDataDir, 'logs', 'render-api.log');
      if (!existsSync(logPath)) return null;
      const lines = readFileSync(logPath, 'utf8').trim().split('\n');
      const last = JSON.parse(lines[lines.length - 1]);
      return last.event === 'listening' ? last.port : null;
    },
    { timeoutMs: 15_000, intervalMs: 500, label: 'render-api port' },
  );
  log('render-api', `pid=${renderApiPid} port=${port}`);

  const healthNoToken = await rawHttpRequest({
    port,
    path: '/api/health',
    headers: { Host: `127.0.0.1:${port}` },
  });
  const healthBadHost = await rawHttpRequest({
    port,
    path: '/api/health',
    headers: { Host: 'evil.example', 'x-studio-token': token },
  });
  const guardResults = { noToken: healthNoToken.status, badHost: healthBadHost.status };
  log('guard', JSON.stringify(guardResults));

  const { cdp: studioCdp, hasCard } = await driveStudioProjectList(DEBUG_PORT, port, TUTORIAL.sourceSlug);
  log('studio', `project card present: ${hasCard}`);

  await openProducerPage(studioCdp, TUTORIAL.sourceSlug);

  if (process.env.PACKAGED_SMOKE_DRY_RUN === '1') {
    const dryRunReport = {
      macosVersion: sh('sw_vers -productVersion'),
      dmgPath,
      appPath,
      spctlDmg,
      spctlApp,
      firstRunElapsedMs,
      defaultFolder,
      claudeStatus,
      guardResults,
      projectCardPresent: hasCard,
      producerPageOpened: true,
    };
    writeFileSync(join(workDir, 'dry-run-report.json'), JSON.stringify(dryRunReport, null, 2));
    process.stdout.write(`\n${JSON.stringify(dryRunReport, null, 2)}\n`);
    process.stdout.write(`\nworkDir: ${workDir}\n`);
    studioCdp.close();
    const quitOutput = spawnSyncResult('osascript', ['-e', 'tell application "Video Maker" to quit']);
    process.stdout.write(`\nosascript output: ${JSON.stringify(quitOutput)}\n`);
    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const alive = sh(`pgrep -f "${appPath}/Contents/MacOS/Video Maker" || true`);
      process.stdout.write(`t+${i + 1}s alive pids: [${alive.split('\n').join(',')}]\n`);
      if (alive === '') break;
    }
    mirror.close();
    return;
  }

  const conversationStartedAt = Date.now();
  const { allToolCalls, lastStatus } = await driveConversation(studioCdp);
  const renderJob = await waitForRenderJob(studioCdp, TUTORIAL.turnDeadlineMs);
  const renderElapsedMs = Date.now() - conversationStartedAt;

  const outDir = join(projectsDir, TUTORIAL.sourceSlug, 'out');
  const mp4Path = existsSync(outDir) ? findLatestMp4(outDir) : null;
  const probe = mp4Path === null ? null : ffprobeVideoStream(mp4Path);

  const idleRss = sumRss(processTreeSnapshot(child.pid));

  studioCdp.close();

  execSync(`osascript -e 'tell application "Video Maker" to quit'`, { stdio: 'ignore' });
  await waitFor(
    async () => sh(`pgrep -f "${appPath}/Contents/MacOS/Video Maker" || true`) === '',
    { timeoutMs: 15_000, intervalMs: 500, label: 'app process to exit after quit' },
  );
  const escapedAppPath = appPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const orphans = sh(
    `pgrep -fl 'render-api/main.js|chrome-headless-shell|ffmpeg|whisper-cli|sherpa-onnx-offline-tts|${escapedAppPath}.*claude -p' || true`,
  );

  mirror.close();

  const reopenChild = spawn(
    appBinary,
    [`--remote-debugging-port=${DEBUG_PORT + 1}`],
    {
      env: finderLaunchEnv(userDataDir),
      stdio: ['ignore', 'ignore', 'ignore'],
    },
  );
  const reopenTargetsRaw = await waitFor(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${DEBUG_PORT + 1}/json`);
        return await response.json();
      } catch {
        return null;
      }
    },
    { timeoutMs: 30_000, intervalMs: 1000, label: 'reopened app CDP targets' },
  );
  const reopenedSetup = reopenTargetsRaw.some((target) => target.url.includes('setup.html'));
  const reopenTarget2 = await waitForCdpTarget(DEBUG_PORT + 1, 'http://127.0.0.1:', 30_000);
  const reopenCdp = new CdpSession(reopenTarget2.webSocketDebuggerUrl);
  const reopenHasProjectAndConversation = await waitFor(
    async () => {
      const raw = await reopenCdp.evaluate(
        `document.querySelector('[data-testid="video-card"][data-video="${TUTORIAL.sourceSlug}"]') !== null`,
      );
      return JSON.parse(raw) ? true : null;
    },
    { timeoutMs: 20_000, intervalMs: 1000, label: 'project card present after reopen' },
  );
  await openProducerPage(reopenCdp, TUTORIAL.sourceSlug);
  const conversationMessageCount = JSON.parse(
    await reopenCdp.evaluate("document.querySelectorAll('[data-testid=\"producer-message-list\"] > li').length"),
  );
  reopenCdp.close();
  execSync(`osascript -e 'tell application "Video Maker" to quit'`, { stdio: 'ignore' });

  const report = {
    macosVersion: sh('sw_vers -productVersion'),
    dmgPath,
    appPath,
    spctlDmg,
    spctlApp,
    firstRunElapsedMs,
    defaultFolder,
    claudeStatus,
    guardResults,
    projectCardPresent: hasCard,
    conversation: { allToolCalls, lastStatus },
    renderJob,
    renderElapsedMs,
    mp4Path,
    probe,
    idleRssKb: idleRss,
    orphansAfterQuit: orphans,
    reopenedSetup,
    reopenHasProjectAndConversation,
    conversationMessageCount,
  };

  writeFileSync(join(workDir, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`\nreport written to ${join(workDir, 'report.json')}\n`);
}

main().catch((error) => {
  process.stderr.write(`\npackaged-app-smoke failed: ${error.stack ?? error.message}\n`);
  process.exit(1);
});
