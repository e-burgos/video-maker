import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChildProcessLike, LogWriter, SpawnFn } from './render-api-process';
import { killProcessGroup, startRenderApiProcess } from './render-api-process';

class FakeChildProcess extends EventEmitter implements ChildProcessLike {
  readonly pid: number | undefined;
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();

  constructor(pid: number | undefined) {
    super();
    this.pid = pid;
  }
}

function fakeLogWriter(): LogWriter & { chunks: string[]; closed: boolean } {
  const state = { chunks: [] as string[], closed: false };
  return {
    chunks: state.chunks,
    get closed() {
      return state.closed;
    },
    write(chunk) {
      state.chunks.push(chunk);
    },
    close() {
      state.closed = true;
    },
  };
}

let tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'render-api-process-spec-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
  vi.restoreAllMocks();
});

describe('startRenderApiProcess (fake spawner)', () => {
  it('waits for GET /health to succeed before resolving', async () => {
    const child = new FakeChildProcess(4242);
    const spawnFn: SpawnFn = vi.fn(() => child);
    let healthCalls = 0;
    const fetchFn = vi.fn(async () => {
      healthCalls += 1;
      return { ok: healthCalls >= 3 } as Response;
    });

    const handle = await startRenderApiProcess(
      { command: 'node', args: ['main.js'], env: {}, cwd: '/repo' },
      { healthUrl: 'http://127.0.0.1:4310/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, healthPollIntervalMs: 1, logWriter: fakeLogWriter() },
    );

    expect(handle.pid).toBe(4242);
    expect(healthCalls).toBeGreaterThanOrEqual(3);
  });

  it('pipes stdout and stderr into the log writer', async () => {
    const child = new FakeChildProcess(10);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response);
    const logWriter = fakeLogWriter();

    await startRenderApiProcess(
      { command: 'node', args: [], env: {}, cwd: '/repo' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, logWriter },
    );

    child.stdout.emit('data', Buffer.from('stdout line\n'));
    child.stderr.emit('data', Buffer.from('stderr line\n'));

    expect(logWriter.chunks).toContain('stdout line\n');
    expect(logWriter.chunks).toContain('stderr line\n');
  });

  it('passes the launch command through to the spawner unchanged', async () => {
    const child = new FakeChildProcess(11);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response);

    await startRenderApiProcess(
      { command: 'node', args: ['-r', 'register.cjs', 'main.ts'], env: { FOO: 'bar' }, cwd: '/repo/apps' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, logWriter: fakeLogWriter() },
    );

    expect(spawnFn).toHaveBeenCalledWith(
      'node',
      ['-r', 'register.cjs', 'main.ts'],
      expect.objectContaining({ cwd: '/repo/apps', env: { FOO: 'bar' }, detached: true }),
    );
  });

  it('rejects when the process exits before becoming healthy', async () => {
    const child = new FakeChildProcess(12);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: false }) as Response);

    const pending = startRenderApiProcess(
      { command: 'node', args: [], env: {}, cwd: '/repo' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, healthPollIntervalMs: 1, logWriter: fakeLogWriter() },
    );

    child.emit('exit', 1, null);

    await expect(pending).rejects.toThrow('exited before it became healthy');
  });

  it('rejects when the health check never succeeds within the timeout', async () => {
    const child = new FakeChildProcess(13);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: false }) as Response);

    await expect(
      startRenderApiProcess(
        { command: 'node', args: [], env: {}, cwd: '/repo' },
        {
          healthUrl: 'http://x/health',
          logFilePath: '/tmp/unused.log',
          fetchFn,
          spawnFn,
          startupTimeoutMs: 20,
          healthPollIntervalMs: 5,
          logWriter: fakeLogWriter(),
        },
      ),
    ).rejects.toThrow('did not answer');
  });

  it('stop() sends signals and resolves as soon as the child reports it exited', async () => {
    const child = new FakeChildProcess(999999);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response);

    const handle = await startRenderApiProcess(
      { command: 'node', args: [], env: {}, cwd: '/repo' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, logWriter: fakeLogWriter(), stopGraceMs: 5000 },
    );

    const stopPromise = handle.stop();
    child.emit('exit', 0, 'SIGTERM');
    await stopPromise;
  });

  it('stop() is a no-op once the process has already exited', async () => {
    const child = new FakeChildProcess(999998);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response);

    const handle = await startRenderApiProcess(
      { command: 'node', args: [], env: {}, cwd: '/repo' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, logWriter: fakeLogWriter() },
    );

    child.emit('exit', 0, null);
    await handle.stop();
  });

  it('calls every registered exit listener when the child exits', async () => {
    const child = new FakeChildProcess(14);
    const spawnFn: SpawnFn = vi.fn(() => child);
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response);

    const handle = await startRenderApiProcess(
      { command: 'node', args: [], env: {}, cwd: '/repo' },
      { healthUrl: 'http://x/health', logFilePath: '/tmp/unused.log', fetchFn, spawnFn, logWriter: fakeLogWriter() },
    );

    const listener = vi.fn();
    handle.onExit(listener);
    child.emit('exit', 0, null);

    expect(listener).toHaveBeenCalledWith({ code: 0, signal: null });
  });
});

describe('createRotatingLogWriter', () => {
  it('rotates the log file once it grows past the size limit', async () => {
    const { createRotatingLogWriter } = await import('./render-api-process');
    const dir = makeTempDir();
    const filePath = join(dir, 'render-api.log');
    const writer = createRotatingLogWriter(filePath, 20);

    writer.write('0123456789');
    writer.write('0123456789');
    writer.write('this line triggers rotation\n');
    writer.close();

    const rotated = readFileSync(`${filePath}.1`, 'utf8');
    const current = readFileSync(filePath, 'utf8');
    expect(rotated).toBe('01234567890123456789');
    expect(current).toBe('this line triggers rotation\n');
  });
});

describe('killProcessGroup (unreachable pid)', () => {
  it('swallows the error when neither the group nor the pid exist', () => {
    expect(() => killProcessGroup(999997, 'SIGTERM')).not.toThrow();
  });
});

describe('killProcessGroup (real process tree)', () => {
  it('kills every descendant of a detached process group, not just the direct child', async () => {
    const child = spawn(
      'bash',
      [
        '-c',
        'sleep 60 & (sleep 60 & wait) & wait',
      ],
      { detached: true, stdio: 'ignore' },
    );
    const pid = child.pid;
    expect(pid).toBeDefined();
    if (pid === undefined) return;

    await sleep(300);
    const before = spawn('pgrep', ['-g', String(pid)]);
    const beforeLines = await collectLines(before);
    expect(beforeLines.length).toBeGreaterThan(0);

    killProcessGroup(pid, 'SIGKILL');
    await sleep(300);

    const after = spawn('pgrep', ['-g', String(pid)]);
    const afterLines = await collectLines(after);
    expect(afterLines.length).toBe(0);
  });
});

function collectLines(child: ReturnType<typeof spawn>): Promise<string[]> {
  return new Promise((resolve) => {
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('close', () => {
      resolve(stdout.split('\n').filter((line) => line.trim() !== ''));
    });
  });
}
