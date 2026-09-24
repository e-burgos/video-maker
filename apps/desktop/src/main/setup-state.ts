import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

export interface InstalledModelRecord {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface SetupState {
  readonly models: Readonly<Record<string, InstalledModelRecord>>;
  readonly projectsFolder: string | null;
  readonly completed: boolean;
}

export const EMPTY_SETUP_STATE: SetupState = { models: {}, projectsFolder: null, completed: false };

function isInstalledModelRecord(value: unknown): value is InstalledModelRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.path === 'string' && typeof record.sizeBytes === 'number' && typeof record.sha256 === 'string'
  );
}

function parseSetupState(raw: unknown): SetupState {
  if (typeof raw !== 'object' || raw === null) {
    return EMPTY_SETUP_STATE;
  }
  const record = raw as Record<string, unknown>;

  const models: Record<string, InstalledModelRecord> = {};
  const rawModels = record.models;
  if (typeof rawModels === 'object' && rawModels !== null) {
    for (const [id, value] of Object.entries(rawModels as Record<string, unknown>)) {
      if (isInstalledModelRecord(value)) {
        models[id] = value;
      }
    }
  }

  return {
    models,
    projectsFolder: typeof record.projectsFolder === 'string' ? record.projectsFolder : null,
    completed: record.completed === true,
  };
}

export function loadSetupState(setupJsonPath: string): SetupState {
  if (!existsSync(setupJsonPath)) {
    return EMPTY_SETUP_STATE;
  }
  try {
    return parseSetupState(JSON.parse(readFileSync(setupJsonPath, 'utf8')));
  } catch (error) {
    void error;
    return EMPTY_SETUP_STATE;
  }
}

export function saveSetupState(setupJsonPath: string, state: SetupState): void {
  mkdirSync(dirname(setupJsonPath), { recursive: true });
  writeFileSync(setupJsonPath, `${JSON.stringify(state, null, 2)}\n`);
}

export function recordModelInstalled(state: SetupState, id: string, artifact: InstalledModelRecord): SetupState {
  return { ...state, models: { ...state.models, [id]: artifact } };
}

export function withProjectsFolder(state: SetupState, projectsFolder: string): SetupState {
  return { ...state, projectsFolder };
}

export function withCompleted(state: SetupState, completed: boolean): SetupState {
  return { ...state, completed };
}

export interface VerifyFileDeps {
  statSize(path: string): number | null;
  sha256(path: string): string;
}

export const nodeVerifyFileDeps: VerifyFileDeps = {
  statSize(path) {
    try {
      return statSync(path).size;
    } catch (error) {
      void error;
      return null;
    }
  },
  sha256(path) {
    const hash = createHash('sha256');
    hash.update(readFileSync(path));
    return hash.digest('hex');
  },
};

export function verifyModelsReady(
  state: SetupState,
  requiredIds: readonly string[],
  deps: VerifyFileDeps = nodeVerifyFileDeps,
): boolean {
  return requiredIds.every((id) => {
    const record = state.models[id];
    if (record === undefined) {
      return false;
    }
    const size = deps.statSize(record.path);
    if (size === null) {
      return false;
    }
    if (size === record.sizeBytes) {
      return true;
    }
    return deps.sha256(record.path) === record.sha256;
  });
}
