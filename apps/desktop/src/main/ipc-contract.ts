export const SETUP_CHANNELS = {
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

export interface DownloadPlanEntry {
  readonly id: string;
  readonly sizeBytes: number;
}

export interface SetupInitialData {
  readonly locale: 'es' | 'en';
  readonly defaultProjectsFolder: string;
  readonly downloadPlan: readonly DownloadPlanEntry[];
  readonly alreadyInstalledIds: readonly string[];
}

export interface DownloadProgressEvent {
  readonly id: string;
  readonly bytesDownloaded: number;
  readonly totalBytes: number;
  readonly overallBytesDownloaded: number;
  readonly overallTotalBytes: number;
}

export interface DownloadOutcome {
  readonly id: string;
  readonly ok: boolean;
  readonly error?: string;
}

export type ClaudeLoginStatusPayload = 'yes' | 'no' | 'unknown';

export interface ClaudeStatusPayload {
  readonly found: boolean;
  readonly path: string | null;
  readonly version: string | null;
  readonly loggedIn: ClaudeLoginStatusPayload;
}

export interface SetupApi {
  getInitialData(): Promise<SetupInitialData>;
  startDownloads(): Promise<readonly DownloadOutcome[]>;
  onDownloadProgress(listener: (event: DownloadProgressEvent) => void): () => void;
  chooseProjectsFolder(): Promise<string | null>;
  setProjectsFolder(path: string): Promise<void>;
  checkClaude(): Promise<ClaudeStatusPayload>;
  openClaudeInstallDocs(): Promise<void>;
  finishSetup(): Promise<void>;
  continueWithoutClaude(): Promise<void>;
}
