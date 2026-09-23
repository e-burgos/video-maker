import { spawn as nodeSpawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

export interface LaunchCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
}

export interface ReadableStreamLike {
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
}

export interface ChildProcessLike {
  readonly pid: number | undefined;
  readonly stdout: ReadableStreamLike | null;
  readonly stderr: ReadableStreamLike | null;
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface SpawnOptionsLike {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly detached: boolean;
  readonly stdio: ['ignore', 'pipe', 'pipe'];
}

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptionsLike) => ChildProcessLike;

const defaultSpawn: SpawnFn = (command, args, options) =>
  nodeSpawn(command, [...args], options) as unknown as ChildProcessLike;

export interface LogWriter {
  write(chunk: string): void;
  close(): void;
}

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;

export function createRotatingLogWriter(filePath: string, maxBytes = DEFAULT_MAX_LOG_BYTES): LogWriter {
  mkdirSync(dirname(filePath), { recursive: true });
  let currentSize = existsSync(filePath) ? statSync(filePath).size : 0;

  function rotateIfNeeded(nextChunkSize: number): void {
    if (currentSize + nextChunkSize <= maxBytes) {
      return;
    }
    const rotatedPath = `${filePath}.1`;
    if (existsSync(rotatedPath)) {
      rmSync(rotatedPath);
    }
    if (existsSync(filePath)) {
      renameSync(filePath, rotatedPath);
    }
    currentSize = 0;
  }

  return {
    write(chunk) {
      const size = Buffer.byteLength(chunk);
      rotateIfNeeded(size);
      appendFileSync(filePath, chunk);
      currentSize += size;
    },
    close() {
      void 0;
    },
  };
}

export function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (groupError) {
    void groupError;
    try {
      process.kill(pid, signal);
    } catch (pidError) {
      void pidError;
    }
  }
}

function stopProcessGroup(pid: number, graceMs: number, exited: Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    killProcessGroup(pid, 'SIGTERM');
    void exited.then(finish);

    const timer = setTimeout(() => {
      if (!settled) {
        killProcessGroup(pid, 'SIGKILL');
      }
      finish();
    }, graceMs);
    timer.unref?.();
  });
}

export interface RenderApiExitInfo {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

export type RenderApiExitListener = (info: RenderApiExitInfo) => void;

export interface RenderApiHandle {
  readonly pid: number;
  onExit(listener: RenderApiExitListener): () => void;
  stop(): Promise<void>;
}

export interface StartRenderApiProcessOptions {
  readonly healthUrl: string;
  readonly logFilePath: string;
  readonly startupTimeoutMs?: number;
  readonly healthPollIntervalMs?: number;
  readonly stopGraceMs?: number;
  readonly spawnFn?: SpawnFn;
  readonly fetchFn?: typeof fetch;
  readonly logWriter?: LogWriter;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_POLL_INTERVAL_MS = 300;
const DEFAULT_STOP_GRACE_MS = 3_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
  pollIntervalMs: number,
  hasExited: () => boolean,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (hasExited()) {
      throw new Error('render-api exited before it became healthy');
    }
    try {
      const response = await fetchFn(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      void error;
    }
    if (Date.now() >= deadline) {
      throw new Error(`render-api did not answer ${url} within ${timeoutMs}ms`);
    }
    await delay(pollIntervalMs);
  }
}

export async function startRenderApiProcess(
  launch: LaunchCommand,
  options: StartRenderApiProcessOptions,
): Promise<RenderApiHandle> {
  const spawnFn = options.spawnFn ?? defaultSpawn;
  const fetchFn = options.fetchFn ?? fetch;
  const logWriter = options.logWriter ?? createRotatingLogWriter(options.logFilePath);

  const child = spawnFn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (child.pid === undefined) {
    throw new Error('render-api process failed to start (no pid)');
  }
  const pid = child.pid;

  child.stdout?.on('data', (chunk) => logWriter.write(chunk.toString()));
  child.stderr?.on('data', (chunk) => logWriter.write(chunk.toString()));

  const exitListeners = new Set<RenderApiExitListener>();
  let exited = false;
  let resolveExited!: () => void;
  const exitedPromise = new Promise<void>((resolve) => {
    resolveExited = resolve;
  });

  child.on('exit', (code, signal) => {
    exited = true;
    logWriter.close();
    resolveExited();
    for (const listener of exitListeners) {
      listener({ code, signal });
    }
  });
  child.on('error', () => {
    exited = true;
    resolveExited();
  });

  await waitForHealth(
    fetchFn,
    options.healthUrl,
    options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
    options.healthPollIntervalMs ?? DEFAULT_HEALTH_POLL_INTERVAL_MS,
    () => exited,
  );

  return {
    pid,
    onExit(listener) {
      exitListeners.add(listener);
      return () => exitListeners.delete(listener);
    },
    async stop() {
      if (exited) return;
      await stopProcessGroup(pid, options.stopGraceMs ?? DEFAULT_STOP_GRACE_MS, exitedPromise);
    },
  };
}
