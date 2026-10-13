import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

import { appDirectoriesToCreate, resolveAppPaths } from './app-paths';
import type { AppPaths } from './app-paths';
import { checkClaudeCli } from './claude-cli-check';
import type { ClaudeCliStatus } from './claude-cli-check';
import { SETUP_CHANNELS } from './ipc-contract';
import type { DownloadOutcome, SetupInitialData } from './ipc-contract';
import { readLoginShellPath, resolveClaudeCli } from './login-shell-path';
import { buildDownloadPlan, downloadAllModels } from './model-downloads';
import type { ManifestModels } from './model-downloads';
import { externalUrlToOpen } from './external-navigation';
import { killProcessGroup, startRenderApiProcess } from './render-api-process';
import type { LaunchCommand, RenderApiHandle } from './render-api-process';
import {
  killStaleRenderApiIfAny,
  removeRenderApiPidFile,
  renderApiIdentityMarker,
  renderApiPidFilePath,
  writeRenderApiPidFile,
} from './render-api-pid-guard';
import { buildRenderApiEnv } from './render-api-env';
import { killOrphanableChromeChildren } from './kill-orphan-chrome';
import { DEFAULT_LOCALE, menuStrings } from './menu-strings';
import { resolvePreferredPort } from './preferred-port';
import {
  loadSetupState,
  recordModelInstalled,
  saveSetupState,
  verifyModelsReady,
  withCompleted,
  withPreferredPort,
  withProjectsFolder,
} from './setup-state';
import type { SetupState } from './setup-state';

const REPO_ROOT_MARKER = 'nx.json';
const RENDER_API_HOST = '127.0.0.1';
const STUDIO_TOKEN_HEADER = 'x-studio-token';
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;
const SETUP_WINDOW_WIDTH = 640;
const SETUP_WINDOW_HEIGHT = 760;
const CLAUDE_INSTALL_DOCS_URL = 'https://docs.claude.com/en/docs/claude-code/setup';

const userDataOverride = process.env.VIDEO_MAKER_USER_DATA;
if (userDataOverride !== undefined && userDataOverride !== '') {
  app.setPath('userData', resolvePath(userDataOverride));
}

let mainWindow: BrowserWindow | null = null;
let currentRenderApi: RenderApiHandle | null = null;
let currentShuttingDown = false;
let currentUserDataDir: string | null = null;

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

interface ResourceLocation {
  readonly isPackaged: boolean;
  readonly repoRoot: string;
  readonly resourcesDir: string;
}

function manifestJsonPath(location: ResourceLocation): string {
  return location.isPackaged
    ? join(location.resourcesDir, 'manifest.json')
    : join(location.repoRoot, 'apps', 'desktop', 'vendor', 'manifest.json');
}

function setupHtmlPath(location: ResourceLocation): string {
  return location.isPackaged
    ? join(location.resourcesDir, 'app.asar', 'setup', 'setup.html')
    : join(location.repoRoot, 'dist', 'out-tsc', 'apps', 'desktop', 'src', 'setup', 'setup.html');
}

function setupPreloadPath(location: ResourceLocation): string {
  return location.isPackaged
    ? join(location.resourcesDir, 'app.asar', 'preload', 'setup-preload.js')
    : join(location.repoRoot, 'dist', 'out-tsc', 'apps', 'desktop', 'src', 'preload', 'setup-preload.js');
}

function thirdPartyNoticesPath(location: ResourceLocation): string {
  return location.isPackaged
    ? join(location.resourcesDir, 'THIRD_PARTY_NOTICES.md')
    : join(location.repoRoot, 'apps', 'desktop', 'vendor', 'THIRD_PARTY_NOTICES.md');
}

function loadManifestModels(location: ResourceLocation): ManifestModels {
  const raw = JSON.parse(readFileSync(manifestJsonPath(location), 'utf8')) as { models: ManifestModels };
  return raw.models;
}

function requiredModelIds(models: ManifestModels): readonly string[] {
  return ['whisperModel', ...models.voices.map((voice) => `voice:${voice.id}`), 'chromeHeadlessShell'];
}

function alreadyInstalledIds(state: SetupState, requiredIds: readonly string[]): readonly string[] {
  return requiredIds.filter((id) => verifyModelsReady(state, [id]));
}

function detectedLocale(): 'es' | 'en' {
  return DEFAULT_LOCALE;
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

function buildApplicationMenu(
  paths: AppPaths,
  noticesPath: string,
  onChangeProjectsFolder: () => void,
): void {
  const strings = menuStrings();
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: strings.preferences,
      submenu: [
        {
          label: strings.projectsFolder,
          click: onChangeProjectsFolder,
        },
      ],
    },
    { role: 'windowMenu' },
    {
      label: strings.help,
      submenu: [
        {
          label: strings.openLogsFolder,
          click: () => {
            void shell.openPath(paths.logsDir);
          },
        },
        {
          label: strings.aboutLicenses,
          click: () => {
            void shell.openPath(noticesPath);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

interface SetupSessionInput {
  readonly paths: AppPaths;
  readonly models: ManifestModels;
  readonly requiredIds: readonly string[];
  readonly setupJsonPath: string;
  readonly initialState: SetupState;
  readonly locale: 'es' | 'en';
  readonly htmlPath: string;
  readonly preloadPath: string;
}

function runSetupWindow(input: SetupSessionInput): Promise<{ projectsFolder: string }> {
  return new Promise((resolve) => {
    let state = input.initialState;
    const plan = buildDownloadPlan(input.models, input.paths.modelsDir);

    const setupWindow = new BrowserWindow({
      width: SETUP_WINDOW_WIDTH,
      height: SETUP_WINDOW_HEIGHT,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: input.preloadPath,
      },
    });

    function removeHandlers(): void {
      for (const channel of Object.values(SETUP_CHANNELS)) {
        if (channel !== SETUP_CHANNELS.downloadProgress) {
          ipcMain.removeHandler(channel);
        }
      }
    }

    function finish(): void {
      const projectsFolder = state.projectsFolder ?? input.paths.defaultProjectsDir;
      state = withProjectsFolder(withCompleted(state, true), projectsFolder);
      saveSetupState(input.setupJsonPath, state);
      removeHandlers();
      if (!setupWindow.isDestroyed()) {
        setupWindow.destroy();
      }
      resolve({ projectsFolder });
    }

    ipcMain.handle(
      SETUP_CHANNELS.getInitialData,
      async (): Promise<SetupInitialData> => ({
        locale: input.locale,
        defaultProjectsFolder: input.paths.defaultProjectsDir,
        downloadPlan: plan.map((item) => ({ id: item.id, sizeBytes: item.sizeBytes })),
        alreadyInstalledIds: alreadyInstalledIds(state, input.requiredIds),
      }),
    );

    ipcMain.handle(SETUP_CHANNELS.startDownloads, async (): Promise<readonly DownloadOutcome[]> => {
      const results = await downloadAllModels(plan, (progress) => {
        if (!setupWindow.isDestroyed()) {
          setupWindow.webContents.send(SETUP_CHANNELS.downloadProgress, progress);
        }
      });
      for (const result of results) {
        if (result.ok && result.artifact !== undefined) {
          state = recordModelInstalled(state, result.id, result.artifact);
        }
      }
      saveSetupState(input.setupJsonPath, state);
      return results.map((result) =>
        result.error === undefined
          ? { id: result.id, ok: result.ok }
          : { id: result.id, ok: result.ok, error: result.error },
      );
    });

    ipcMain.handle(SETUP_CHANNELS.chooseProjectsFolder, async (): Promise<string | null> => {
      const result = await dialog.showOpenDialog(setupWindow, { properties: ['openDirectory', 'createDirectory'] });
      const chosen = result.filePaths[0];
      return result.canceled || chosen === undefined ? null : chosen;
    });

    ipcMain.handle(SETUP_CHANNELS.setProjectsFolder, (_event, projectsFolder: string): void => {
      state = withProjectsFolder(state, projectsFolder);
      saveSetupState(input.setupJsonPath, state);
    });

    ipcMain.handle(SETUP_CHANNELS.checkClaude, async (): Promise<ClaudeCliStatus> => {
      const loginShellPath = await readLoginShellPath();
      const claudeCliPath = await resolveClaudeCli({ loginShellPath });
      return checkClaudeCli({ claudeCliPath });
    });

    ipcMain.handle(SETUP_CHANNELS.openClaudeInstallDocs, async (): Promise<void> => {
      await shell.openExternal(CLAUDE_INSTALL_DOCS_URL);
    });

    ipcMain.handle(SETUP_CHANNELS.finishSetup, (): void => finish());
    ipcMain.handle(SETUP_CHANNELS.continueWithoutClaude, (): void => finish());

    setupWindow.on('closed', removeHandlers);

    void setupWindow.loadFile(input.htmlPath);
  });
}

async function shutdownCurrent(): Promise<void> {
  if (currentShuttingDown) return;
  currentShuttingDown = true;
  if (currentRenderApi !== null) {
    await currentRenderApi.stop();
  }
  if (currentUserDataDir !== null) {
    removeRenderApiPidFile(renderApiPidFilePath(currentUserDataDir));
  }
}

async function startStudio(input: {
  paths: AppPaths;
  projectsFolder: string;
  repoRoot: string;
  port: number;
}): Promise<void> {
  if (currentRenderApi !== null) {
    await currentRenderApi.stop();
    currentRenderApi = null;
  }
  currentShuttingDown = false;

  const port = input.port;
  const token = randomBytes(32).toString('hex');
  const env = await buildRenderApiEnv({
    paths: input.paths,
    host: RENDER_API_HOST,
    port,
    token,
    projectsFolder: input.projectsFolder,
    isPackaged: app.isPackaged,
    parentPid: process.pid,
  });
  const launchCommand = buildLaunchCommand({
    isPackaged: app.isPackaged,
    repoRoot: input.repoRoot,
    resourcesDir: input.paths.resourcesDir,
    env,
  });

  let renderApi: RenderApiHandle;
  try {
    renderApi = await startRenderApiProcess(launchCommand, {
      healthUrl: `http://${RENDER_API_HOST}:${port}/health`,
      healthHeaders: { [STUDIO_TOKEN_HEADER]: token },
      logFilePath: join(input.paths.logsDir, 'render-api.log'),
    });
  } catch (error) {
    dialog.showErrorBox('Video Maker', `render-api failed to start: ${(error as Error).message}`);
    app.quit();
    return;
  }
  currentRenderApi = renderApi;
  writeRenderApiPidFile(renderApiPidFilePath(input.paths.userDataDir), renderApi.pid);

  renderApi.onExit(() => {
    void (async () => {
      await killOrphanableChromeChildren({
        browserExecutablePath: input.paths.chromeHeadlessShellPath,
        killProcessGroup: (pid) => killProcessGroup(pid, 'SIGKILL'),
      });
      killProcessGroup(renderApi.pid, 'SIGKILL');

      if (currentShuttingDown || mainWindow === null) return;
      const choice = dialog.showMessageBoxSync(mainWindow, {
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
    })();
  });

  const target = resolveWindowTarget({
    isPackaged: app.isPackaged,
    webDevUrl: process.env.WEB_DEV_URL,
    host: RENDER_API_HOST,
    port,
    token,
  });

  if (mainWindow === null) {
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
    routeExternalNavigationToSystemBrowser(window, new URL(target).origin);
    window.on('closed', () => {
      mainWindow = null;
      app.quit();
    });
    window.webContents.on('render-process-gone', () => {
      void shutdownCurrent().finally(() => app.quit());
    });
    await window.loadURL(target);
  } else {
    await mainWindow.loadURL(target);
  }
}

function routeExternalNavigationToSystemBrowser(window: BrowserWindow, appOrigin: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    const external = externalUrlToOpen(url, appOrigin);
    if (external !== null) void shell.openExternal(external);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const external = externalUrlToOpen(url, appOrigin);
    if (external === null) return;
    event.preventDefault();
    void shell.openExternal(external);
  });
}

async function changeProjectsFolder(paths: AppPaths, repoRoot: string, port: number): Promise<void> {
  if (mainWindow === null) return;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  const chosen = result.filePaths[0];
  if (result.canceled || chosen === undefined) return;

  const setupJsonPath = join(paths.userDataDir, 'setup.json');
  const state = withProjectsFolder(loadSetupState(setupJsonPath), chosen);
  saveSetupState(setupJsonPath, state);

  await startStudio({ paths, projectsFolder: chosen, repoRoot, port });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

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
  currentUserDataDir = paths.userDataDir;

  const location: ResourceLocation = { isPackaged: app.isPackaged, repoRoot, resourcesDir: paths.resourcesDir };

  killStaleRenderApiIfAny(
    renderApiPidFilePath(paths.userDataDir),
    renderApiIdentityMarker({ isPackaged: app.isPackaged, resourcesDir: paths.resourcesDir }),
    { killProcessGroup: (pid) => killProcessGroup(pid, 'SIGKILL') },
  );

  const models = loadManifestModels(location);
  const requiredIds = requiredModelIds(models);
  const setupJsonPath = join(paths.userDataDir, 'setup.json');
  let state = loadSetupState(setupJsonPath);

  const port = await resolvePreferredPort(RENDER_API_HOST, state.preferredPort);
  if (port !== state.preferredPort) {
    state = withPreferredPort(state, port);
    saveSetupState(setupJsonPath, state);
  }

  buildApplicationMenu(paths, thirdPartyNoticesPath(location), () => {
    void changeProjectsFolder(paths, repoRoot, port);
  });

  const setupReady = state.completed && state.projectsFolder !== null && verifyModelsReady(state, requiredIds);

  let projectsFolder: string;
  if (setupReady) {
    projectsFolder = state.projectsFolder as string;
  } else {
    const result = await runSetupWindow({
      paths,
      models,
      requiredIds,
      setupJsonPath,
      initialState: state,
      locale: detectedLocale(),
      htmlPath: setupHtmlPath(location),
      preloadPath: setupPreloadPath(location),
    });
    projectsFolder = result.projectsFolder;
  }

  await startStudio({ paths, projectsFolder, repoRoot, port });
}

app.on('before-quit', () => {
  void shutdownCurrent();
});
app.on('will-quit', () => {
  void shutdownCurrent();
});
process.on('exit', () => {
  if (!currentShuttingDown && currentRenderApi !== null) {
    killProcessGroup(currentRenderApi.pid, 'SIGKILL');
  }
});

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
    return;
  });
  bootstrap().catch((error: unknown) => {
    dialog.showErrorBox('Video Maker', `Failed to start: ${(error as Error).message}`);
    app.quit();
  });
}
