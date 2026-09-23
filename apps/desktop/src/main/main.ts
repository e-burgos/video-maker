import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

import { appDirectoriesToCreate, resolveAppPaths } from './app-paths';
import type { AppPaths } from './app-paths';
import { getFreePort } from './free-port';
import { mergePathWithDefault, readLoginShellPath, resolveClaudeCli } from './login-shell-path';
import { killProcessGroup, startRenderApiProcess } from './render-api-process';
import type { LaunchCommand, RenderApiHandle } from './render-api-process';

const REPO_ROOT_MARKER = 'nx.json';
const RENDER_API_HOST = '127.0.0.1';
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;

let mainWindow: BrowserWindow | null = null;

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, REPO_ROOT_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`could not find ${REPO_ROOT_MARKER} above ${startDir}`);
    }
    dir = parent;
  }
}

async function ensureSetupComplete(): Promise<void> {
  return Promise.resolve();
}

function buildLaunchCommand(input: {
  isPackaged: boolean;
  repoRoot: string;
  resourcesDir: string;
  env: NodeJS.ProcessEnv;
}): LaunchCommand {
  if (input.isPackaged) {
    return {
      command: process.execPath,
      args: [join(input.resourcesDir, 'render-api', 'main.js')],
      cwd: input.resourcesDir,
      env: { ...input.env, ELECTRON_RUN_AS_NODE: '1' },
    };
  }

  return {
    command: 'node',
    args: ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    cwd: input.repoRoot,
    env: { ...input.env, SWC_NODE_PROJECT: 'tsconfig.base.json' },
  };
}

async function buildRenderApiEnv(input: { paths: AppPaths; port: number; token: string }): Promise<NodeJS.ProcessEnv> {
  const loginShellPath = await readLoginShellPath();
  const mergedPath = mergePathWithDefault(loginShellPath, process.env.PATH ?? '');
  const claudeCliPath = await resolveClaudeCli({ loginShellPath });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: mergedPath,
    RENDER_API_HOST,
    RENDER_API_PORT: String(input.port),
    RENDER_API_MEDIA_ROOT: input.paths.defaultProjectsDir,
    RENDER_API_DB_PATH: input.paths.dbPath,
    VIDEO_MAKER_BIN_DIR: input.paths.vendorBinDir,
    VIDEO_MAKER_MODELS_DIR: input.paths.modelsDir,
    RENDER_API_ACCESS_TOKEN: input.token,
    REMOTION_BROWSER_EXECUTABLE: input.paths.chromeHeadlessShellPath,
  };

  if (claudeCliPath !== null) {
    env.CLAUDE_CLI_PATH = claudeCliPath;
  }
  if (input.paths.remotionServeUrl !== null) {
    env.REMOTION_SERVE_URL = input.paths.remotionServeUrl;
  }

  return env;
}

const PLACEHOLDER_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Video Maker</title>
<style>body{font:14px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee}</style>
</head><body><p>The studio web build is not wired up yet in this cycle.</p></body></html>`;

function appendToken(url: string, token: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${token}`;
}

function resolveWindowTarget(input: {
  isPackaged: boolean;
  webDevUrl: string | undefined;
  host: string;
  port: number;
  token: string;
}): string {
  if (!input.isPackaged) {
    if (input.webDevUrl !== undefined && input.webDevUrl !== '') {
      return appendToken(input.webDevUrl, input.token);
    }
    return `data:text/html;charset=utf-8,${encodeURIComponent(PLACEHOLDER_HTML)}`;
  }
  return appendToken(`http://${input.host}:${input.port}/`, input.token);
}

function buildApplicationMenu(paths: AppPaths): void {
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open logs folder',
          click: () => {
            void shell.openPath(paths.logsDir);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  await ensureSetupComplete();

  const repoRoot = app.isPackaged ? process.resourcesPath : findRepoRoot(__dirname);
  const paths = resolveAppPaths({
    userDataDir: app.getPath('userData'),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    repoRoot,
  });
  for (const dir of appDirectoriesToCreate(paths)) {
    mkdirSync(dir, { recursive: true });
  }

  buildApplicationMenu(paths);

  const port = await getFreePort(RENDER_API_HOST);
  const token = randomBytes(32).toString('hex');

  const env = await buildRenderApiEnv({ paths, port, token });
  const launchCommand = buildLaunchCommand({
    isPackaged: app.isPackaged,
    repoRoot,
    resourcesDir: paths.resourcesDir,
    env,
  });

  let renderApi: RenderApiHandle;
  try {
    renderApi = await startRenderApiProcess(launchCommand, {
      healthUrl: `http://${RENDER_API_HOST}:${port}/health`,
      logFilePath: join(paths.logsDir, 'render-api.log'),
    });
  } catch (error) {
    dialog.showErrorBox('Video Maker', `render-api failed to start: ${(error as Error).message}`);
    app.quit();
    return;
  }

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await renderApi.stop();
  };

  app.on('before-quit', () => {
    void shutdown();
  });
  app.on('will-quit', () => {
    void shutdown();
  });
  process.on('exit', () => {
    if (!shuttingDown) {
      killProcessGroup(renderApi.pid, 'SIGKILL');
    }
  });

  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.on('closed', () => {
    mainWindow = null;
  });

  window.webContents.on('render-process-gone', () => {
    void shutdown().finally(() => app.quit());
  });

  renderApi.onExit(() => {
    if (shuttingDown) return;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'error',
      message: 'render-api stopped unexpectedly',
      buttons: ['Restart', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 1) {
      app.quit();
    } else {
      app.relaunch();
      app.quit();
    }
  });

  const target = resolveWindowTarget({
    isPackaged: app.isPackaged,
    webDevUrl: process.env.WEB_DEV_URL,
    host: RENDER_API_HOST,
    port,
    token,
  });
  await window.loadURL(target);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.on('window-all-closed', () => {
    app.quit();
  });
  void bootstrap();
}
