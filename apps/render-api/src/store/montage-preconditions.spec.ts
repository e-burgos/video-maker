import type { DirectoryEntry, DirectoryReader } from '@video-maker/auto-montage';
import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { assertMontageProjectIsIngestable, assertTimelineNotPersisted } from './montage-preconditions';
import { assertTimelineNotPersisted as assertTimelineNotPersistedFromProjectScope } from './project-scope';

const PROJECT_ROOT = '/media/acme-launch';
const PROJECT = resolveMediaProject(PROJECT_ROOT);

function directoryEntry(name: string, isDirectory: boolean): DirectoryEntry {
  return { name, isDirectory, isFile: !isDirectory };
}

function readDirectoryFrom(entriesByPath: ReadonlyMap<string, readonly DirectoryEntry[]>): DirectoryReader {
  return {
    readDirectory: async (path) => {
      const entries = entriesByPath.get(path);
      if (entries === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entries;
    },
  };
}

describe('assertTimelineNotPersisted re-export', () => {
  it('reexposes the exact function implemented in project-scope, without duplicating it', () => {
    expect(assertTimelineNotPersisted).toBe(assertTimelineNotPersistedFromProjectScope);
  });
});

describe('assertMontageProjectIsIngestable', () => {
  it('rejects with MONTAGE_RAW_MISSING and the project slug when the project root cannot be read', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(new Map()),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
      resource: PROJECT.slug,
    });
  });

  it('never checks raw/ once the project root itself is unreadable (fails cheap, in order)', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(new Map()),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
    });
    expect(callLog.ports()).toEqual(['readDirectory']);
  });

  it('rejects with MONTAGE_RAW_MISSING and resource "raw" when raw/ cannot be read', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(new Map([[PROJECT.root, []]])),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
      resource: 'raw',
      expected: 'a readable raw/ directory',
    });
  });

  it('rejects with MONTAGE_RAW_MISSING and resource "raw" when raw/ has no recognized role directory', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(
        new Map([
          [PROJECT.root, []],
          [PROJECT.rawDir, [directoryEntry('notes.txt', false)]],
        ]),
      ),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
      resource: 'raw',
    });
  });

  it('ignores a file that happens to share a role directory name', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(
        new Map([
          [PROJECT.root, []],
          [PROJECT.rawDir, [directoryEntry('aroll', false)]],
        ]),
      ),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
      resource: 'raw',
    });
  });

  it.each(['aroll', 'broll', 'images', 'audio'])(
    'resolves when raw/ contains a %s directory',
    async (roleDirectoryName) => {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog, {
        readDirectory: readDirectoryFrom(
          new Map([
            [PROJECT.root, []],
            [PROJECT.rawDir, [directoryEntry(roleDirectoryName, true)]],
          ]),
        ),
      });

      await expect(assertMontageProjectIsIngestable(PROJECT, deps)).resolves.toBeUndefined();
    },
  );

  it('fails cheap: never invokes createCommandRunner or resolveMontageBinaries when raw/ has no role directory', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      readDirectory: readDirectoryFrom(
        new Map([
          [PROJECT.root, []],
          [PROJECT.rawDir, []],
        ]),
      ),
    });

    await expect(assertMontageProjectIsIngestable(PROJECT, deps)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
    });
    expect(callLog.ports()).not.toContain('createCommandRunner');
    expect(callLog.ports()).not.toContain('resolveMontageBinaries');
  });
});
