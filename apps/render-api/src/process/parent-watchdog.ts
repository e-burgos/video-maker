export const PARENT_PID_ENV_VAR = 'VIDEO_MAKER_PARENT_PID';

const DEFAULT_POLL_INTERVAL_MS = 2_000;

export function readParentPid(env: NodeJS.ProcessEnv): number | null {
  const raw = env[PARENT_PID_ENV_VAR];
  if (raw === undefined || raw === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export interface ParentWatchdogOptions {
  readonly pollIntervalMs?: number;
  readonly isAlive?: (pid: number) => boolean;
  readonly setIntervalFn?: (callback: () => void, ms: number) => NodeJS.Timeout;
  readonly clearIntervalFn?: (handle: NodeJS.Timeout) => void;
}

export function startParentWatchdog(
  env: NodeJS.ProcessEnv,
  onParentGone: () => void,
  options: ParentWatchdogOptions = {},
): () => void {
  const parentPid = readParentPid(env);
  if (parentPid === null) {
    return () => undefined;
  }

  const isAlive = options.isAlive ?? isProcessAlive;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;

  const timer = setIntervalFn(() => {
    if (!isAlive(parentPid)) {
      clearIntervalFn(timer);
      onParentGone();
    }
  }, pollIntervalMs);
  timer.unref?.();

  return () => clearIntervalFn(timer);
}
