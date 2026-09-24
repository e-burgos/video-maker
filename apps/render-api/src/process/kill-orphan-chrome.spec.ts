import { describe, expect, it, vi } from 'vitest';

import {
  directChildrenByCommand,
  killOrphanableChromeChildren,
  parsePsOutput,
} from './kill-orphan-chrome';
import type { ProcessEntry } from './kill-orphan-chrome';

describe('parsePsOutput', () => {
  it('parses pid, ppid and the full command line from ps -Ao output', () => {
    const stdout = [
      '  1     0 /sbin/launchd',
      '4242     1 node dist/apps/render-api/main.js',
      '4300  4242 /Users/dev/App/vendor/darwin-arm64/chrome-headless-shell --type=browser --profile /tmp/x',
      '',
    ].join('\n');

    expect(parsePsOutput(stdout)).toEqual([
      { pid: 1, ppid: 0, command: '/sbin/launchd' },
      { pid: 4242, ppid: 1, command: 'node dist/apps/render-api/main.js' },
      {
        pid: 4300,
        ppid: 4242,
        command: '/Users/dev/App/vendor/darwin-arm64/chrome-headless-shell --type=browser --profile /tmp/x',
      },
    ]);
  });

  it('skips lines it cannot parse instead of throwing', () => {
    expect(parsePsOutput('garbage\n\n  12   3  ok')).toEqual([{ pid: 12, ppid: 3, command: 'ok' }]);
  });
});

describe('directChildrenByCommand', () => {
  const entries: readonly ProcessEntry[] = [
    { pid: 100, ppid: 1, command: '/bin/chrome-headless-shell --type=browser' },
    { pid: 200, ppid: 100, command: '/bin/chrome-headless-shell --type=gpu-process' },
    { pid: 300, ppid: 1, command: 'ffmpeg -i in.mp4 out.mp4' },
  ];

  it('finds only the direct children of the given parent whose command matches the needle', () => {
    expect(directChildrenByCommand(entries, 1, '/bin/chrome-headless-shell')).toEqual([100]);
  });

  it('returns nothing when no direct child matches', () => {
    expect(directChildrenByCommand(entries, 1, '/bin/whisper-cli')).toEqual([]);
  });
});

describe('killOrphanableChromeChildren', () => {
  it('does nothing when no browser executable path is configured', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn();

    await killOrphanableChromeChildren({ parentPid: 1, browserExecutablePath: null, killProcessGroup, listProcessesFn });

    expect(listProcessesFn).not.toHaveBeenCalled();
    expect(killProcessGroup).not.toHaveBeenCalled();
  });

  it('kills the process group of every direct chrome-headless-shell child, covering its own gpu/renderer/network subprocesses', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn().mockResolvedValue([
      { pid: 500, ppid: 42, command: '/App/chrome-headless-shell --type=browser' },
      { pid: 600, ppid: 500, command: '/App/chrome-headless-shell --type=gpu-process' },
      { pid: 700, ppid: 42, command: 'node whisper-cli' },
    ]);

    await killOrphanableChromeChildren({
      parentPid: 42,
      browserExecutablePath: '/App/chrome-headless-shell',
      killProcessGroup,
      listProcessesFn,
    });

    expect(killProcessGroup).toHaveBeenCalledTimes(1);
    expect(killProcessGroup).toHaveBeenCalledWith(500);
  });

  it('swallows a failure to list processes instead of throwing', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn().mockRejectedValue(new Error('ps not found'));

    await expect(
      killOrphanableChromeChildren({
        parentPid: 42,
        browserExecutablePath: '/App/chrome-headless-shell',
        killProcessGroup,
        listProcessesFn,
      }),
    ).resolves.toBeUndefined();
    expect(killProcessGroup).not.toHaveBeenCalled();
  });
});
