import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const RENDER_API_PID_FILE_NAME = 'render-api.pid';

export function renderApiPidFilePath(userDataDir: string): string {
  return join(userDataDir, RENDER_API_PID_FILE_NAME);
}

export function writeRenderApiPidFile(pidFilePath: string, pid: number): void {
  writeFileSync(pidFilePath, `${pid}\n`);
}

export function removeRenderApiPidFile(pidFilePath: string): void {
  try {
    rmSync(pidFilePath);
  } catch (error) {
    void error;
  }
}

export function readRenderApiPidFile(pidFilePath: string): number | null {
  if (!existsSync(pidFilePath)) {
    return null;
  }
  try {
    const parsed = Number(readFileSync(pidFilePath, 'utf8').trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch (error) {
    void error;
    return null;
  }
}

export function readProcessCommand(pid: number): string | null {
  try {
    const output = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
    const trimmed = output.trim();
    return trimmed === '' ? null : trimmed;
  } catch (error) {
    void error;
    return null;
  }
}

export interface RenderApiIdentity {
  readonly isPackaged: boolean;
  readonly resourcesDir: string;
}

export function renderApiIdentityMarker(identity: RenderApiIdentity): string {
  return identity.isPackaged
    ? join(identity.resourcesDir, 'render-api', 'main.js')
    : join('apps', 'render-api', 'src', 'main.ts');
}

export interface KillStaleRenderApiDeps {
  readonly readPidFile?: (pidFilePath: string) => number | null;
  readonly readCommand?: (pid: number) => string | null;
  readonly killProcessGroup: (pid: number) => void;
  readonly removePidFile?: (pidFilePath: string) => void;
}

export function killStaleRenderApiIfAny(
  pidFilePath: string,
  identityMarker: string,
  deps: KillStaleRenderApiDeps,
): void {
  const readPidFile = deps.readPidFile ?? readRenderApiPidFile;
  const readCommand = deps.readCommand ?? readProcessCommand;
  const removePidFile = deps.removePidFile ?? removeRenderApiPidFile;

  const pid = readPidFile(pidFilePath);
  if (pid === null) {
    return;
  }

  const command = readCommand(pid);
  if (command !== null && command.includes(identityMarker)) {
    deps.killProcessGroup(pid);
  }
  removePidFile(pidFilePath);
}
