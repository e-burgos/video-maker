import type { ProducerConfig } from '../config/producer-config';
import type {
  ProducerAgentPort,
  ProducerTurnResult,
  ProducerTurnRun,
  ProducerTurnStart,
  SpawnProducerProcess,
} from './producer-agent';

export const PRODUCER_KILL_GRACE_MS = 5_000;
export const PRODUCER_STDERR_MAX_CHARS = 4_000;

export function producerCliArgs(start: ProducerTurnStart): readonly string[] {
  return [
    '--print',
    start.text,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'dontAsk',
    '--model',
    start.model,
    '--append-system-prompt',
    start.systemPrompt,
    '--add-dir',
    start.projectRoot,
    ...(start.resume ? ['--resume', start.sessionId] : ['--session-id', start.sessionId]),
    '--allowedTools',
    ...start.allowedTools,
  ];
}

interface LineSplitter {
  readonly push: (chunk: string) => void;
  readonly flush: () => void;
}

function createLineSplitter(onLine: (line: string) => void): LineSplitter {
  let pending = '';

  return {
    push: (chunk) => {
      pending += chunk;
      let newlineIndex = pending.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = pending.slice(0, newlineIndex).replace(/\r$/u, '');
        pending = pending.slice(newlineIndex + 1);
        if (line !== '') {
          onLine(line);
        }
        newlineIndex = pending.indexOf('\n');
      }
    },
    flush: () => {
      const line = pending.trim();
      pending = '';
      if (line !== '') {
        onLine(line);
      }
    },
  };
}

export function createClaudeCodeProducerAgent(
  spawnProcess: SpawnProducerProcess,
  config: ProducerConfig,
  scheduleTimeout: (callback: () => void, ms: number) => () => void,
): ProducerAgentPort {
  return (start, onLine): ProducerTurnRun => {
    const splitter = createLineSplitter(onLine);
    let stderr = '';
    let canceled = false;
    let timedOut = false;
    let spawnFailed = false;
    let settled = false;

    let resolveCompleted: (result: ProducerTurnResult) => void = () => undefined;
    const completed = new Promise<ProducerTurnResult>((resolve) => {
      resolveCompleted = resolve;
    });

    const child = spawnProcess({
      command: config.binaryPath,
      args: producerCliArgs(start),
      cwd: config.workingDirectory,
    });

    let cancelForceKill = (): void => undefined;
    const cancelTimeout = scheduleTimeout(() => {
      timedOut = true;
      forceKill();
    }, config.timeoutMs);

    function forceKill(): void {
      child.kill('SIGTERM');
      cancelForceKill = scheduleTimeout(() => {
        child.kill('SIGKILL');
      }, PRODUCER_KILL_GRACE_MS);
    }

    function settle(exitCode: number | null): void {
      if (settled) {
        return;
      }
      settled = true;
      cancelTimeout();
      cancelForceKill();
      splitter.flush();
      resolveCompleted({ exitCode, canceled, timedOut, spawnFailed, stderr });
    }

    child.onStdout((chunk) => {
      splitter.push(chunk);
    });

    child.onStderr((chunk) => {
      stderr = `${stderr}${chunk}`.slice(0, PRODUCER_STDERR_MAX_CHARS);
    });

    child.onSpawnError(() => {
      spawnFailed = true;
      settle(null);
    });

    child.onExit((exitCode) => {
      settle(exitCode);
    });

    return {
      cancel: () => {
        if (settled || canceled) {
          return;
        }
        canceled = true;
        forceKill();
      },
      completed,
    };
  };
}
