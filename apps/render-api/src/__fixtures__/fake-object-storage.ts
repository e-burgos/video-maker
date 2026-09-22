import type {
  ObjectStorage,
  StorageEntry,
  StorageStat,
  WriteTemporaryOutcome,
} from '../deps/object-storage';
import type { CallLog } from './call-log';

type StorageRecord =
  | { readonly kind: 'file'; readonly bytes: Uint8Array; readonly modifiedAtMs: number }
  | { readonly kind: 'directory'; readonly modifiedAtMs: number };

export interface FakeObjectStorageFileSeed {
  readonly path: string;
  readonly contents: string;
  readonly modifiedAtMs?: number;
}

export interface FakeObjectStorageSeed {
  readonly directories?: readonly string[];
  readonly files?: readonly FakeObjectStorageFileSeed[];
}

export interface FakeObjectStorageControl {
  readonly queueStat: (path: string, ...values: readonly (StorageStat | null)[]) => void;
  readonly queueWriteOutcome: (outcome: WriteTemporaryOutcome) => void;
  readonly queueReadTextFileError: (path: string, error: NodeJS.ErrnoException) => void;
}

export interface FakeObjectStorage extends ObjectStorage {
  readonly control: FakeObjectStorageControl;
}

const DEFAULT_MODIFIED_AT_MS = 1_757_289_600_000;

function encode(contents: string): Uint8Array {
  return new TextEncoder().encode(contents);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function toStat(record: StorageRecord): StorageStat {
  return record.kind === 'file'
    ? { kind: 'file', sizeBytes: record.bytes.length, modifiedAtMs: record.modifiedAtMs }
    : { kind: 'directory', sizeBytes: 0, modifiedAtMs: record.modifiedAtMs };
}

function toEnoent(path: string): NodeJS.ErrnoException {
  const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

export function createFakeObjectStorage(callLog: CallLog, seed?: FakeObjectStorageSeed): FakeObjectStorage {
  const records = new Map<string, StorageRecord>();
  const statQueues = new Map<string, (StorageStat | null)[]>();
  const readTextFileErrorQueues = new Map<string, NodeJS.ErrnoException[]>();
  const writeOutcomeQueue: WriteTemporaryOutcome[] = [];
  let temporaryFileSequence = 0;

  for (const directory of seed?.directories ?? []) {
    records.set(directory, { kind: 'directory', modifiedAtMs: DEFAULT_MODIFIED_AT_MS });
  }
  for (const file of seed?.files ?? []) {
    records.set(file.path, {
      kind: 'file',
      bytes: encode(file.contents),
      modifiedAtMs: file.modifiedAtMs ?? DEFAULT_MODIFIED_AT_MS,
    });
  }

  function hasDescendant(path: string): boolean {
    const prefix = `${path}/`;
    for (const key of records.keys()) {
      if (key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  function computeStat(path: string): StorageStat | null {
    const record = records.get(path);
    if (record) {
      return toStat(record);
    }
    return hasDescendant(path)
      ? { kind: 'directory', sizeBytes: 0, modifiedAtMs: DEFAULT_MODIFIED_AT_MS }
      : null;
  }

  return {
    control: {
      queueStat: (path, ...values) => {
        const queue = statQueues.get(path) ?? [];
        queue.push(...values);
        statQueues.set(path, queue);
      },
      queueWriteOutcome: (outcome) => {
        writeOutcomeQueue.push(outcome);
      },
      queueReadTextFileError: (path, error) => {
        const queue = readTextFileErrorQueues.get(path) ?? [];
        queue.push(error);
        readTextFileErrorQueues.set(path, queue);
      },
    },

    stat: async (path) => {
      callLog.record('stat', path);
      const queuedValue = statQueues.get(path)?.shift();
      if (queuedValue !== undefined) {
        return queuedValue;
      }
      return computeStat(path);
    },

    listDirectory: async (path) => {
      callLog.record('listDirectory', path);
      const record = records.get(path);
      if (record && record.kind === 'file') {
        return null;
      }
      if (!record && !hasDescendant(path)) {
        return null;
      }

      const prefix = `${path}/`;
      const entries = new Map<string, StorageEntry>();
      for (const [key, value] of records.entries()) {
        if (!key.startsWith(prefix)) {
          continue;
        }
        const remainder = key.slice(prefix.length);
        const name = remainder.split('/')[0];
        if (name === undefined || name === '' || entries.has(name)) {
          continue;
        }
        const isDirectory = remainder !== name || value.kind === 'directory';
        entries.set(name, { name, isDirectory, isFile: !isDirectory });
      }
      return [...entries.values()];
    },

    ensureDirectory: async (path) => {
      callLog.record('ensureDirectory', path);
      if (!records.has(path)) {
        records.set(path, { kind: 'directory', modifiedAtMs: DEFAULT_MODIFIED_AT_MS });
      }
    },

    readTextFile: async (path) => {
      callLog.record('readTextFile', path);
      const queuedError = readTextFileErrorQueues.get(path)?.shift();
      if (queuedError) {
        throw queuedError;
      }
      const record = records.get(path);
      if (!record || record.kind !== 'file') {
        throw toEnoent(path);
      }
      return decode(record.bytes);
    },

    writeTextFile: async (path, contents) => {
      callLog.record('writeTextFile', { path, contents });
      records.set(path, { kind: 'file', bytes: encode(contents), modifiedAtMs: DEFAULT_MODIFIED_AT_MS });
    },

    openReadStream: (path, range) => {
      callLog.record('openReadStream', { path, range });
      const record = records.get(path);
      const bytes = record && record.kind === 'file' ? record.bytes : new Uint8Array(0);
      const slice = range ? bytes.slice(range.start, range.end + 1) : bytes;
      return {
        async *[Symbol.asyncIterator]() {
          yield slice;
        },
      };
    },

    writeTemporary: async (input) => {
      callLog.record('writeTemporary', {
        directory: input.directory,
        expectedBytes: input.expectedBytes,
        limitBytes: input.limitBytes,
      });

      const queuedOutcome = writeOutcomeQueue.shift();
      if (queuedOutcome) {
        return queuedOutcome;
      }

      const chunks: Uint8Array[] = [];
      let bytesWritten = 0;
      try {
        for await (const chunk of input.source) {
          bytesWritten += chunk.length;
          if (bytesWritten > input.limitBytes) {
            return { kind: 'limit-exceeded', limitBytes: input.limitBytes };
          }
          chunks.push(chunk);
        }
      } catch {
        return { kind: 'aborted' };
      }

      if (bytesWritten !== input.expectedBytes) {
        return { kind: 'aborted' };
      }

      temporaryFileSequence += 1;
      const temporaryPath = `${input.directory}/upload-${temporaryFileSequence}.part`;
      const merged = new Uint8Array(bytesWritten);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      records.set(temporaryPath, { kind: 'file', bytes: merged, modifiedAtMs: DEFAULT_MODIFIED_AT_MS });

      return { kind: 'written', temporaryPath, bytesWritten };
    },

    promoteTemporary: async (temporaryPath, finalPath) => {
      callLog.record('promoteTemporary', { temporaryPath, finalPath });
      const record = records.get(temporaryPath);
      if (record) {
        records.delete(temporaryPath);
        records.set(finalPath, record);
      }
    },

    removeTemporary: async (path) => {
      callLog.record('removeTemporary', path);
      records.delete(path);
    },

    removeFile: async (path) => {
      callLog.record('removeFile', path);
      records.delete(path);
    },

    removeDirectory: async (path) => {
      callLog.record('removeDirectory', path);
      const prefix = `${path}/`;
      for (const key of [...records.keys()]) {
        if (key === path || key.startsWith(prefix)) {
          records.delete(key);
        }
      }
    },
  };
}
