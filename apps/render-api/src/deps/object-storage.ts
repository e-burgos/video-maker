export interface StorageEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
}

export interface StorageStat {
  readonly kind: 'file' | 'directory';
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

export interface WriteTemporaryInput {
  readonly directory: string;
  readonly source: AsyncIterable<Uint8Array>;
  readonly expectedBytes: number;
  readonly limitBytes: number;
}

export type WriteTemporaryOutcome =
  | { readonly kind: 'written'; readonly temporaryPath: string; readonly bytesWritten: number }
  | { readonly kind: 'limit-exceeded'; readonly limitBytes: number }
  | { readonly kind: 'aborted' };

export interface ObjectStorage {
  readonly stat: (path: string) => Promise<StorageStat | null>;
  readonly listDirectory: (path: string) => Promise<readonly StorageEntry[] | null>;
  readonly ensureDirectory: (path: string) => Promise<void>;
  readonly readTextFile: (path: string) => Promise<string>;
  readonly writeTextFile: (path: string, contents: string) => Promise<void>;
  readonly openReadStream: (path: string, range?: ByteRange) => AsyncIterable<Uint8Array>;
  readonly writeTemporary: (input: WriteTemporaryInput) => Promise<WriteTemporaryOutcome>;
  readonly promoteTemporary: (temporaryPath: string, finalPath: string) => Promise<void>;
  readonly removeTemporary: (path: string) => Promise<void>;
}
