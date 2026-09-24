import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  killStaleRenderApiIfAny,
  readProcessCommand,
  readRenderApiPidFile,
  removeRenderApiPidFile,
  renderApiIdentityMarker,
  renderApiPidFilePath,
  writeRenderApiPidFile,
} from './render-api-pid-guard';

let tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'render-api-pid-guard-spec-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('renderApiPidFilePath', () => {
  it('places render-api.pid directly under the user data dir', () => {
    expect(renderApiPidFilePath('/Users/dev/Library/Application Support/Video Maker')).toBe(
      '/Users/dev/Library/Application Support/Video Maker/render-api.pid',
    );
  });
});

describe('writeRenderApiPidFile / readRenderApiPidFile', () => {
  it('round-trips a pid through the file', () => {
    const dir = makeTempDir();
    const path = renderApiPidFilePath(dir);

    writeRenderApiPidFile(path, 4242);

    expect(readRenderApiPidFile(path)).toBe(4242);
    expect(readFileSync(path, 'utf8')).toBe('4242\n');
  });

  it('returns null when there is no pid file yet', () => {
    const dir = makeTempDir();
    expect(readRenderApiPidFile(renderApiPidFilePath(dir))).toBeNull();
  });

  it('returns null for a corrupt pid file instead of throwing', () => {
    const dir = makeTempDir();
    const path = renderApiPidFilePath(dir);
    writeRenderApiPidFile(path, Number.NaN);

    expect(readRenderApiPidFile(path)).toBeNull();
  });
});

describe('removeRenderApiPidFile', () => {
  it('removes an existing file and tolerates a missing one', () => {
    const dir = makeTempDir();
    const path = renderApiPidFilePath(dir);
    writeRenderApiPidFile(path, 1);

    removeRenderApiPidFile(path);

    expect(readRenderApiPidFile(path)).toBeNull();
    expect(() => removeRenderApiPidFile(path)).not.toThrow();
  });
});

describe('renderApiIdentityMarker', () => {
  it('points at the bundled main.js inside resources when packaged', () => {
    expect(renderApiIdentityMarker({ isPackaged: true, resourcesDir: '/Applications/Video Maker.app/Contents/Resources' })).toBe(
      '/Applications/Video Maker.app/Contents/Resources/render-api/main.js',
    );
  });

  it('points at the source entrypoint when running from the repo', () => {
    expect(renderApiIdentityMarker({ isPackaged: false, resourcesDir: '/repo' })).toBe(
      'apps/render-api/src/main.ts',
    );
  });
});

describe('readProcessCommand', () => {
  it('reads the real command line of a live process (the current test process)', () => {
    expect(readProcessCommand(process.pid)).not.toBeNull();
  });

  it('is null for a pid that plainly does not exist', () => {
    expect(readProcessCommand(999_999)).toBeNull();
  });
});

describe('killStaleRenderApiIfAny', () => {
  it('does nothing when there is no pid file', () => {
    const killProcessGroup = vi.fn();

    killStaleRenderApiIfAny('/no/such/file', 'marker', { killProcessGroup });

    expect(killProcessGroup).not.toHaveBeenCalled();
  });

  it('kills the process group when the pid still runs a render-api of this app', () => {
    const killProcessGroup = vi.fn();

    killStaleRenderApiIfAny('/pid/file', 'apps/render-api/src/main.ts', {
      readPidFile: () => 555,
      readCommand: (pid) => (pid === 555 ? 'node -r register.cjs apps/render-api/src/main.ts' : null),
      killProcessGroup,
      removePidFile: () => undefined,
    });

    expect(killProcessGroup).toHaveBeenCalledWith(555);
  });

  it('never kills a pid whose command does not match, even if it still exists', () => {
    const killProcessGroup = vi.fn();

    killStaleRenderApiIfAny('/pid/file', 'apps/render-api/src/main.ts', {
      readPidFile: () => 555,
      readCommand: () => 'some-other-process --unrelated',
      killProcessGroup,
      removePidFile: () => undefined,
    });

    expect(killProcessGroup).not.toHaveBeenCalled();
  });

  it('never kills a pid that no longer exists (no command reported)', () => {
    const killProcessGroup = vi.fn();

    killStaleRenderApiIfAny('/pid/file', 'apps/render-api/src/main.ts', {
      readPidFile: () => 555,
      readCommand: () => null,
      killProcessGroup,
      removePidFile: () => undefined,
    });

    expect(killProcessGroup).not.toHaveBeenCalled();
  });

  it('always clears the pid file once checked, whether or not it killed anything', () => {
    const removePidFile = vi.fn();

    killStaleRenderApiIfAny('/pid/file', 'marker', {
      readPidFile: () => 555,
      readCommand: () => null,
      killProcessGroup: () => undefined,
      removePidFile,
    });

    expect(removePidFile).toHaveBeenCalledWith('/pid/file');
  });
});
