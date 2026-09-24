import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { StorageStat } from '../deps/object-storage';
import { directoryHasAnyFile, layoutFlagsFrom } from './project-layout';

const FILE: StorageStat = { kind: 'file', sizeBytes: 42, modifiedAtMs: 0 };

describe('layoutFlagsFrom', () => {
  it('derives the five layout flags from raw/out content and the catalog/timeline/edl file stats', () => {
    expect(
      layoutFlagsFrom({ rawHasFiles: true, catalog: FILE, timeline: FILE, edl: null, outHasFiles: true }),
    ).toEqual({ raw: true, catalog: true, timeline: true, edl: false, out: true });

    expect(
      layoutFlagsFrom({ rawHasFiles: false, catalog: null, timeline: null, edl: null, outHasFiles: false }),
    ).toEqual({ raw: false, catalog: false, timeline: false, edl: false, out: false });
  });

  it('never reports catalog/timeline/edl as present from a directory of the same name', () => {
    const directory: StorageStat = { kind: 'directory', sizeBytes: 0, modifiedAtMs: 0 };

    expect(
      layoutFlagsFrom({ rawHasFiles: false, catalog: directory, timeline: null, edl: null, outHasFiles: false }),
    ).toEqual({ raw: false, catalog: false, timeline: false, edl: false, out: false });
  });
});

describe('directoryHasAnyFile', () => {
  it('is false when the directory does not exist at all', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);

    expect(await directoryHasAnyFile(storage, '/media/acme/raw')).toBe(false);
  });

  it('is false for an empty directory, even though it exists (a brand-new project)', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/acme/raw', '/media/acme/raw/aroll', '/media/acme/raw/broll'],
    });

    expect(await directoryHasAnyFile(storage, '/media/acme/raw')).toBe(false);
  });

  it('is true as soon as any file exists in a nested role subdirectory', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/acme/raw', '/media/acme/raw/aroll', '/media/acme/raw/broll'],
      files: [{ path: '/media/acme/raw/aroll/clip-0001.mp4', contents: 'x' }],
    });

    expect(await directoryHasAnyFile(storage, '/media/acme/raw')).toBe(true);
  });

  it('is true for a file directly inside a flat directory (out/)', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/acme/out'],
      files: [{ path: '/media/acme/out/final.mp4', contents: 'x' }],
    });

    expect(await directoryHasAnyFile(storage, '/media/acme/out')).toBe(true);
  });
});
