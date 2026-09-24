import { describe, expect, it, vi } from 'vitest';

import {
  killOrphanableChromeChildren,
  parsePsOutput,
  pidsByCommand,
} from './kill-orphan-chrome';
import type { ProcessEntry } from './kill-orphan-chrome';

describe('parsePsOutput', () => {
  it('parses pid, ppid and the full command line from ps -Ao output', () => {
    const stdout = [
      '  1     0 /sbin/launchd',
      '4242     1 /Applications/Video Maker.app/Contents/MacOS/Video Maker /Applications/Video Maker.app/Contents/Resources/render-api/main.js',
      '4300  4242 /Applications/Video Maker.app/Contents/Resources/models/chrome-headless-shell/chrome-headless-shell --type=browser',
      '',
    ].join('\n');

    expect(parsePsOutput(stdout)).toEqual([
      { pid: 1, ppid: 0, command: '/sbin/launchd' },
      {
        pid: 4242,
        ppid: 1,
        command:
          '/Applications/Video Maker.app/Contents/MacOS/Video Maker /Applications/Video Maker.app/Contents/Resources/render-api/main.js',
      },
      {
        pid: 4300,
        ppid: 4242,
        command: '/Applications/Video Maker.app/Contents/Resources/models/chrome-headless-shell/chrome-headless-shell --type=browser',
      },
    ]);
  });

  it('skips lines it cannot parse instead of throwing', () => {
    expect(parsePsOutput('garbage\n\n  12   3  ok')).toEqual([{ pid: 12, ppid: 3, command: 'ok' }]);
  });
});

describe('pidsByCommand', () => {
  const entries: readonly ProcessEntry[] = [
    { pid: 100, ppid: 1, command: '/models/chrome-headless-shell --type=browser' },
    { pid: 200, ppid: 1, command: '/models/chrome-headless-shell --type=gpu-process' },
    { pid: 300, ppid: 1, command: 'ffmpeg -i in.mp4 out.mp4' },
  ];

  it('matches every process whose command contains the needle, regardless of ppid', () => {
    expect(pidsByCommand(entries, '/models/chrome-headless-shell')).toEqual([100, 200]);
  });

  it('returns nothing when no process matches', () => {
    expect(pidsByCommand(entries, '/models/whisper-cli')).toEqual([]);
  });
});

describe('killOrphanableChromeChildren', () => {
  it('kills every process whose command matches the browser executable path, even after it was reparented to launchd (ppid=1)', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn().mockResolvedValue([
      { pid: 500, ppid: 1, command: '/App/chrome-headless-shell --type=browser' },
      { pid: 600, ppid: 1, command: '/App/chrome-headless-shell --type=gpu-process' },
      { pid: 700, ppid: 1, command: 'node whisper-cli' },
    ]);

    await killOrphanableChromeChildren({
      browserExecutablePath: '/App/chrome-headless-shell',
      killProcessGroup,
      listProcessesFn,
    });

    expect(killProcessGroup).toHaveBeenCalledTimes(2);
    expect(killProcessGroup).toHaveBeenCalledWith(500);
    expect(killProcessGroup).toHaveBeenCalledWith(600);
  });

  it('swallows a failure to list processes instead of throwing', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn().mockRejectedValue(new Error('ps not found'));

    await expect(
      killOrphanableChromeChildren({
        browserExecutablePath: '/App/chrome-headless-shell',
        killProcessGroup,
        listProcessesFn,
      }),
    ).resolves.toBeUndefined();
    expect(killProcessGroup).not.toHaveBeenCalled();
  });

  it('does nothing when no chrome process exists', async () => {
    const killProcessGroup = vi.fn();
    const listProcessesFn = vi.fn().mockResolvedValue([{ pid: 700, ppid: 1, command: 'node whisper-cli' }]);

    await killOrphanableChromeChildren({
      browserExecutablePath: '/App/chrome-headless-shell',
      killProcessGroup,
      listProcessesFn,
    });

    expect(killProcessGroup).not.toHaveBeenCalled();
  });
});
