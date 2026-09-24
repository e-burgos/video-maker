import { contextBridge, ipcRenderer } from 'electron';

import type { DownloadProgressEvent, SetupApi } from '../main/ipc-contract';

// duplicated from ipc-contract.ts: a sandboxed preload can only require() electron/node builtins, never local project files
const SETUP_CHANNELS = {
  getInitialData: 'setup:get-initial-data',
  startDownloads: 'setup:start-downloads',
  downloadProgress: 'setup:download-progress',
  chooseProjectsFolder: 'setup:choose-projects-folder',
  setProjectsFolder: 'setup:set-projects-folder',
  checkClaude: 'setup:check-claude',
  openClaudeInstallDocs: 'setup:open-claude-install-docs',
  finishSetup: 'setup:finish-setup',
  continueWithoutClaude: 'setup:continue-without-claude',
} as const;

const api: SetupApi = {
  getInitialData: () => ipcRenderer.invoke(SETUP_CHANNELS.getInitialData),
  startDownloads: () => ipcRenderer.invoke(SETUP_CHANNELS.startDownloads),
  onDownloadProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: DownloadProgressEvent) => listener(payload);
    ipcRenderer.on(SETUP_CHANNELS.downloadProgress, handler);
    return () => ipcRenderer.removeListener(SETUP_CHANNELS.downloadProgress, handler);
  },
  chooseProjectsFolder: () => ipcRenderer.invoke(SETUP_CHANNELS.chooseProjectsFolder),
  setProjectsFolder: (path) => ipcRenderer.invoke(SETUP_CHANNELS.setProjectsFolder, path),
  checkClaude: () => ipcRenderer.invoke(SETUP_CHANNELS.checkClaude),
  openClaudeInstallDocs: () => ipcRenderer.invoke(SETUP_CHANNELS.openClaudeInstallDocs),
  finishSetup: () => ipcRenderer.invoke(SETUP_CHANNELS.finishSetup),
  continueWithoutClaude: () => ipcRenderer.invoke(SETUP_CHANNELS.continueWithoutClaude),
};

contextBridge.exposeInMainWorld('setupApi', api);
