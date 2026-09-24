import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { SetupState, VerifyFileDeps } from './setup-state';
import {
  EMPTY_SETUP_STATE,
  loadSetupState,
  recordModelInstalled,
  saveSetupState,
  verifyModelsReady,
  withCompleted,
  withPreferredPort,
  withProjectsFolder,
} from './setup-state';

let tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'setup-state-spec-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('loadSetupState', () => {
  it('returns the empty state when the file does not exist', () => {
    const dir = makeTempDir();
    expect(loadSetupState(join(dir, 'setup.json'))).toEqual(EMPTY_SETUP_STATE);
  });

  it('returns the empty state when the file has invalid JSON', () => {
    const dir = makeTempDir();
    const path = join(dir, 'setup.json');
    writeFileSync(path, 'not json');
    expect(loadSetupState(path)).toEqual(EMPTY_SETUP_STATE);
  });

  it('drops malformed model records but keeps the rest of the state', () => {
    const dir = makeTempDir();
    const path = join(dir, 'setup.json');
    writeFileSync(
      path,
      JSON.stringify({
        models: { whisperModel: { path: '/x', sizeBytes: 10, sha256: 'abc' }, broken: { path: 123 } },
        projectsFolder: '/Users/friend/projects',
        completed: true,
      }),
    );

    const state = loadSetupState(path);
    expect(state.models).toEqual({ whisperModel: { path: '/x', sizeBytes: 10, sha256: 'abc' } });
    expect(state.projectsFolder).toBe('/Users/friend/projects');
    expect(state.completed).toBe(true);
  });
});

describe('saveSetupState / loadSetupState round trip', () => {
  it('persists and reloads the exact same state', () => {
    const dir = makeTempDir();
    const path = join(dir, 'nested', 'setup.json');

    let state = EMPTY_SETUP_STATE;
    state = recordModelInstalled(state, 'whisperModel', { path: '/models/whisper-model.bin', sizeBytes: 10, sha256: 'aa' });
    state = withProjectsFolder(state, '/Users/friend/projects');
    state = withCompleted(state, true);
    state = withPreferredPort(state, 42123);

    saveSetupState(path, state);
    expect(loadSetupState(path)).toEqual(state);
  });
});

describe('withPreferredPort', () => {
  it('records the port so the next launch can try it again first', () => {
    expect(withPreferredPort(EMPTY_SETUP_STATE, 42500).preferredPort).toBe(42500);
  });
});

describe('verifyModelsReady', () => {
  const baseState: SetupState = {
    models: {
      whisperModel: { path: '/models/whisper-model.bin', sizeBytes: 100, sha256: 'expected-hash' },
    },
    projectsFolder: null,
    completed: true,
    preferredPort: null,
  };

  it('is false when a required model was never recorded', () => {
    expect(verifyModelsReady(baseState, ['whisperModel', 'chromeHeadlessShell'])).toBe(false);
  });

  it('is false when the recorded file is missing on disk', () => {
    const deps: VerifyFileDeps = { statSize: () => null, sha256: () => 'unused' };
    expect(verifyModelsReady(baseState, ['whisperModel'], deps)).toBe(false);
  });

  it('is true on a cheap size match, without hashing', () => {
    let hashCalled = false;
    const deps: VerifyFileDeps = {
      statSize: () => 100,
      sha256: () => {
        hashCalled = true;
        return 'expected-hash';
      },
    };
    expect(verifyModelsReady(baseState, ['whisperModel'], deps)).toBe(true);
    expect(hashCalled).toBe(false);
  });

  it('falls back to a full hash when the size differs, and accepts a matching hash', () => {
    const deps: VerifyFileDeps = { statSize: () => 999, sha256: () => 'expected-hash' };
    expect(verifyModelsReady(baseState, ['whisperModel'], deps)).toBe(true);
  });

  it('is false when the size differs and the hash does not match either', () => {
    const deps: VerifyFileDeps = { statSize: () => 999, sha256: () => 'corrupted-hash' };
    expect(verifyModelsReady(baseState, ['whisperModel'], deps)).toBe(false);
  });
});
