import { execFileSync, execSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = '/Users/macbookprom2/github/personal-projects/video-maker';
const INSTALLED_APP_PATH = '/Applications/Video Maker.app';
const DEV_USER_DATA_DIR = join(homedir(), 'Library', 'Application Support', 'Video Maker');
const SCREENSHOTS_DIR = join(REPO_ROOT, 'apps', 'docs-site', 'public', 'screenshots');
const DEBUG_PORT_MAIN = 9611;
const DEBUG_PORT_SETUP = 9612;
const VIEWPORT = { width: 1440, height: 900 };

const PROJECT_SLUGS = {
  home: ['display-ads-analiticas', 'display-ads-creacion-campana-full-desktop', 'optica-siochana'],
  preview: 'optica-siochana',
  attach: 'display-ads-analiticas',
  material: 'optica-siochana',
};

function log(step, message) {
  process.stdout.write(`[${step}] ${message}\n`);
}

function sh(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function spawnSyncResult(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
  }
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
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.result.exceptionDetails) {
      throw new Error(`CDP evaluate failed: ${JSON.stringify(result.result.exceptionDetails)}`);
    }
    return result.result.result.value;
  }

  async setViewport(width, height) {
    await this.ready();
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 0,
      mobile: false,
    });
  }

  async setFileInputFiles(selector, filePaths) {
    await this.ready();
    await this.send('DOM.enable');
    const doc = await this.send('DOM.getDocument');
    const found = await this.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector });
    await this.send('DOM.setFileInputFiles', { files: filePaths, nodeId: found.result.nodeId });
  }

  close() {
    this.ws.close();
  }

  async screenshot(filePath) {
    await this.ready();
    await this.send('Page.enable');
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(filePath, Buffer.from(result.result.data, 'base64'));
  }
}

function seedCompletedUserData(destUserDataDir) {
  mkdirSync(destUserDataDir, { recursive: true });
  log('seed', `cloning models from ${DEV_USER_DATA_DIR}/models`);
  execFileSync('cp', ['-Rc', join(DEV_USER_DATA_DIR, 'models'), join(destUserDataDir, 'models')]);

  const setup = JSON.parse(readFileSync(join(DEV_USER_DATA_DIR, 'setup.json'), 'utf8'));
  const rewrittenModels = Object.fromEntries(
    Object.entries(setup.models).map(([id, record]) => [
      id,
      { ...record, path: record.path.replace(DEV_USER_DATA_DIR, destUserDataDir) },
    ]),
  );
  const projectsFolder = join(destUserDataDir, 'projects');
  writeFileSync(
    join(destUserDataDir, 'setup.json'),
    JSON.stringify({ ...setup, models: rewrittenModels, projectsFolder, preferredPort: null }, null, 2),
  );

  mkdirSync(projectsFolder, { recursive: true });
  for (const slug of PROJECT_SLUGS.home) {
    log('seed', `cloning project ${slug}`);
    execFileSync('cp', ['-Rc', join(REPO_ROOT, 'media', slug), join(projectsFolder, slug)]);
  }
  return projectsFolder;
}

function renderApiPidUnder(appPid) {
  const tree = sh(`pgrep -P ${appPid} || true`);
  for (const pid of tree.split('\n').filter((line) => line !== '')) {
    const cmd = spawnSyncResult('ps', ['-o', 'command=', '-p', pid]);
    if (cmd.includes('render-api/main.js')) {
      return pid;
    }
  }
  return null;
}

async function waitForRenderApiPort(userDataDir, appPid) {
  await waitFor(async () => renderApiPidUnder(appPid), {
    timeoutMs: 30_000,
    intervalMs: 1000,
    label: 'render-api process to start',
  });
  return waitFor(
    async () => {
      const logPath = join(userDataDir, 'logs', 'render-api.log');
      if (!existsSync(logPath)) return null;
      const lines = readFileSync(logPath, 'utf8').trim().split('\n');
      const last = JSON.parse(lines[lines.length - 1]);
      return last.event === 'listening' ? last.port : null;
    },
    { timeoutMs: 15_000, intervalMs: 500, label: 'render-api port' },
  );
}

async function quitAndWait() {
  const appBinary = join(INSTALLED_APP_PATH, 'Contents', 'MacOS', 'Video Maker');
  spawnSyncResult('osascript', ['-e', 'tell application "Video Maker" to quit']);
  await waitFor(async () => sh(`pgrep -f "${appBinary}" || true`) === '', {
    timeoutMs: 15_000,
    intervalMs: 500,
    label: 'app process to exit after quit',
  });
}

function makeAttachFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'nuevo-clip.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    filePath,
  ]);
  return filePath;
}

async function openProducerPage(cdp, slug) {
  await cdp.evaluate(`document.querySelector('[data-testid="video-card"][data-video="${slug}"] a').click(); true`);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelector(\'[data-testid="producer-composer"]\') !== null')),
    { timeoutMs: 15_000, intervalMs: 500, label: `producer page loaded for ${slug}` },
  );
}

async function goToProjectList(cdp) {
  await cdp.evaluate('document.querySelector(\'a[href="/"]\').click(); true');
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelector(\'[data-testid="video-card"]\') !== null')),
    { timeoutMs: 15_000, intervalMs: 500, label: 'project list after navigating home' },
  );
}

async function selectWorkspaceTab(cdp, tabId) {
  await cdp.evaluate(`document.querySelector('[data-testid="workspace-tab-${tabId}"]').click(); true`);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate(`document.getElementById('workspace-panel-${tabId}') !== null`)),
    { timeoutMs: 5_000, intervalMs: 200, label: `${tabId} tab panel to mount` },
  );
}

async function goToSettings(cdp) {
  await cdp.evaluate('document.querySelector(\'[data-testid="settings-nav"]\').click(); true');
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelector(\'[data-testid="settings-producer-section"]\') !== null')),
    { timeoutMs: 15_000, intervalMs: 500, label: 'settings page loaded' },
  );
}

async function setEngineToOpenRouterAndSave(cdp) {
  await cdp.evaluate(`
    (function () {
      const select = document.getElementById('settings-engine');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'openrouter');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  await cdp.evaluate(`
    (function () {
      const buttons = Array.from(document.querySelectorAll('[data-testid="settings-producer-section"] button'));
      const save = buttons.find((button) => button.textContent.trim() === 'Guardar' || button.textContent.trim() === 'Save');
      save.click();
      return true;
    })()
  `);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelector(\'[data-testid="settings-producer-saved"]\') !== null')),
    { timeoutMs: 10_000, intervalMs: 500, label: 'settings saved confirmation' },
  );
}

async function captureMainWindowScreenshots(userDataDir, attachFixturePath) {
  const appBinary = join(INSTALLED_APP_PATH, 'Contents', 'MacOS', 'Video Maker');
  const child = spawn(appBinary, [`--remote-debugging-port=${DEBUG_PORT_MAIN}`], {
    env: finderLaunchEnv(userDataDir),
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  });

  const port = await waitForRenderApiPort(userDataDir, child.pid);
  log('render-api', `pid under app, port=${port}`);

  const target = await waitForCdpTarget(DEBUG_PORT_MAIN, `127.0.0.1:${port}`, 60_000);
  const cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.setViewport(VIEWPORT.width, VIEWPORT.height);

  await waitFor(
    async () =>
      JSON.parse(
        await cdp.evaluate(
          `document.querySelectorAll('[data-testid="video-card"]').length === ${PROJECT_SLUGS.home.length} && ` +
            `(document.querySelectorAll('[data-testid="video-card-thumbnail"]').length + ` +
            `document.querySelectorAll('[data-testid="video-card-thumbnail-placeholder"]').length) === ${PROJECT_SLUGS.home.length}`,
        ),
      ),
    { timeoutMs: 60_000, intervalMs: 1000, label: 'all project thumbnails resolved on home' },
  );
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'home-projects.png'));
  log('capture', 'wrote home-projects.png');

  await openProducerPage(cdp, PROJECT_SLUGS.preview);
  await selectWorkspaceTab(cdp, 'preview');
  await waitFor(
    async () =>
      JSON.parse(
        await cdp.evaluate(
          'document.querySelector(\'[data-testid="workspace-preview-video"]\') !== null || ' +
            'document.querySelector(\'[data-testid="workspace-preview-empty"]\') !== null || ' +
            'document.querySelector(\'[data-testid="timeline-player"]\') !== null',
        ),
      ),
    { timeoutMs: 15_000, intervalMs: 500, label: 'preview tab content resolved' },
  );
  await cdp.evaluate(`
    (function () {
      const video = document.querySelector('[data-testid="workspace-preview-video"]');
      if (video) { video.currentTime = Math.min(1, video.duration || 1); }
      const playButton = document.querySelector('[data-testid="timeline-player"] button[aria-label="Play video"]');
      if (playButton) { playButton.click(); }
      return true;
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'workspace-preview.png'));
  log('capture', 'wrote workspace-preview.png');

  await goToProjectList(cdp);
  await openProducerPage(cdp, PROJECT_SLUGS.attach);
  await cdp.setFileInputFiles('[data-testid="chat-drop-zone"] input[type="file"]', [attachFixturePath]);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelector(\'[data-testid="asset-proposal-card"]\') !== null')),
    { timeoutMs: 15_000, intervalMs: 500, label: 'proposal card after attaching a file' },
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'proposal-card.png'));
  log('capture', 'wrote proposal-card.png');

  await goToProjectList(cdp);
  await openProducerPage(cdp, PROJECT_SLUGS.material);
  await selectWorkspaceTab(cdp, 'material');
  await waitFor(
    async () =>
      JSON.parse(
        await cdp.evaluate(
          'document.querySelector(\'[data-testid="workspace-material"]\') !== null || document.querySelector(\'[data-testid="workspace-material-empty"]\') !== null',
        ),
      ),
    { timeoutMs: 15_000, intervalMs: 500, label: 'material tab content resolved' },
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'material-tab.png'));
  log('capture', 'wrote material-tab.png');

  await goToSettings(cdp);
  await setEngineToOpenRouterAndSave(cdp);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelectorAll(\'[data-testid="openrouter-model-card"]\').length > 0')),
    { timeoutMs: 20_000, intervalMs: 1000, label: 'recommended model cards' },
  );
  const keyHintVisible = await cdp.evaluate(
    'document.querySelector(\'[data-testid="settings-key-loaded"]\')?.textContent ?? null',
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'settings-openrouter.png'));
  log('capture', `wrote settings-openrouter.png (key hint shown: ${JSON.stringify(keyHintVisible)})`);

  cdp.close();
  await quitAndWait();
  log('quit', 'main capture window closed');
}

async function captureFirstRunSetupScreenshot(userDataDir) {
  const appBinary = join(INSTALLED_APP_PATH, 'Contents', 'MacOS', 'Video Maker');
  const child = spawn(appBinary, [`--remote-debugging-port=${DEBUG_PORT_SETUP}`], {
    env: finderLaunchEnv(userDataDir),
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  });

  const target = await waitForCdpTarget(DEBUG_PORT_SETUP, 'setup.html', 60_000);
  const cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.setViewport(VIEWPORT.width, VIEWPORT.height);
  await waitFor(
    async () => JSON.parse(await cdp.evaluate('document.querySelectorAll(\'.item-row\').length > 0')),
    { timeoutMs: 15_000, intervalMs: 200, label: 'download rows rendered' },
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  await cdp.screenshot(join(SCREENSHOTS_DIR, 'first-run-setup.png'));
  log('capture', 'wrote first-run-setup.png');
  cdp.close();

  await quitAndWait();
  void child;
  log('quit', 'first-run capture window closed (stopped before downloads completed)');
}

async function relaunchDevApp() {
  const cleanEnv = {
    HOME: homedir(),
    PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    USER: userInfo().username,
    LOGNAME: userInfo().username,
    TMPDIR: tmpdir(),
  };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      execFileSync('open', ['-a', 'Video Maker'], { env: cleanEnv, stdio: 'pipe' });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    const launched = await waitFor(
      async () => sh("pgrep -f '/Applications/Video Maker.app/Contents/MacOS/Video Maker' || true") !== '',
      { timeoutMs: 8_000, intervalMs: 500, label: `dev app process after relaunch attempt ${attempt}` },
    ).catch(() => false);
    if (launched) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('could not relaunch the dev app after 5 attempts — relaunch it manually with `open -a "Video Maker"`');
}

async function main() {
  if (!existsSync(INSTALLED_APP_PATH)) {
    throw new Error(`installed app not found at ${INSTALLED_APP_PATH}`);
  }

  const only = process.argv.includes('--only=first-run') ? 'first-run' : 'all';

  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const workDir = mkdtempSync(join(tmpdir(), 'docs-site-screenshots-'));

  if (only === 'all') {
    const mainUserData = join(workDir, 'userData-main');
    seedCompletedUserData(mainUserData);
    const attachFixturePath = makeAttachFixture(join(workDir, 'fixtures'));
    await captureMainWindowScreenshots(mainUserData, attachFixturePath);
  }

  const setupUserData = join(workDir, 'userData-setup');
  mkdirSync(setupUserData, { recursive: true });
  await captureFirstRunSetupScreenshot(setupUserData);

  rmSync(workDir, { recursive: true, force: true });
  log('cleanup', `removed ${workDir}`);
}

main()
  .catch((error) => {
    process.stderr.write(`\ncapture-app-screenshots failed: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    spawnSyncResult('osascript', ['-e', 'tell application "Video Maker" to quit']);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const orphans = sh(
      "pgrep -fl 'render-api/main.js|chrome-headless-shell|ffmpeg|whisper-cli|sherpa-onnx-offline-tts' || true",
    );
    log('orphans', orphans === '' ? 'none' : orphans);
    await relaunchDevApp();
    log('relaunch', 'dev app relaunched with its own real userData');
  });
