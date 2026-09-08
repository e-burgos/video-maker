import type { DirectoryEntry, DirectoryReader, FileStatReader } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { StageInputMissingError } from '../errors/stage-input-missing-error';
import { fixtureMediaProject } from '../__fixtures__/media-project';

import { assertCatalogExists, assertProjectIsIngestable, assertTimelineExists } from './assert-project-preconditions';

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

function statFileFrom(existingPaths: ReadonlySet<string>): FileStatReader {
  return {
    statFile: async (path) => {
      if (!existingPaths.has(path)) {
        throw new Error(`ENOENT: ${path}`);
      }
      return { sizeBytes: 1, modifiedAtMs: 0 };
    },
  };
}

describe('assertProjectIsIngestable', () => {
  it('throws project-root-not-found when the project root cannot be read', async () => {
    const deps = { readDirectory: readDirectoryFrom(new Map()) };

    const error = await assertProjectIsIngestable(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).reason).toBe('project-root-not-found');
    expect((error as StageInputMissingError).stage).toBe('ingest');
    expect((error as StageInputMissingError).resource).toBe(fixtureMediaProject.root);
  });

  it('throws raw-missing when the project root exists but raw/ cannot be read', async () => {
    const deps = {
      readDirectory: readDirectoryFrom(new Map([[fixtureMediaProject.root, []]])),
    };

    const error = await assertProjectIsIngestable(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).reason).toBe('raw-missing');
    expect((error as StageInputMissingError).resource).toBe('raw');
  });

  it('throws raw-has-no-role-directory when raw/ has no recognized role directory', async () => {
    const deps = {
      readDirectory: readDirectoryFrom(
        new Map([
          [fixtureMediaProject.root, []],
          [fixtureMediaProject.rawDir, [directoryEntry('notes.txt', false)]],
        ]),
      ),
    };

    const error = await assertProjectIsIngestable(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).reason).toBe('raw-has-no-role-directory');
    expect((error as StageInputMissingError).resource).toBe('raw');
  });

  it('does not require any file inside a recognized role directory', async () => {
    const deps = {
      readDirectory: readDirectoryFrom(
        new Map([
          [fixtureMediaProject.root, []],
          [fixtureMediaProject.rawDir, [directoryEntry('aroll', true)]],
        ]),
      ),
    };

    await expect(assertProjectIsIngestable(fixtureMediaProject, deps)).resolves.toBeUndefined();
  });

  it.each(['aroll', 'broll', 'images', 'audio'])('accepts a raw/ containing a %s directory', async (roleDirectoryName) => {
    const deps = {
      readDirectory: readDirectoryFrom(
        new Map([
          [fixtureMediaProject.root, []],
          [fixtureMediaProject.rawDir, [directoryEntry(roleDirectoryName, true)]],
        ]),
      ),
    };

    await expect(assertProjectIsIngestable(fixtureMediaProject, deps)).resolves.toBeUndefined();
  });

  it('ignores a file that happens to share a role directory name', async () => {
    const deps = {
      readDirectory: readDirectoryFrom(
        new Map([
          [fixtureMediaProject.root, []],
          [fixtureMediaProject.rawDir, [directoryEntry('aroll', false)]],
        ]),
      ),
    };

    const error = await assertProjectIsIngestable(fixtureMediaProject, deps).catch((caught: unknown) => caught);
    expect((error as StageInputMissingError).reason).toBe('raw-has-no-role-directory');
  });
});

describe('assertCatalogExists', () => {
  it('throws catalog-missing with the hint to run ingest first', async () => {
    const deps = { statFile: statFileFrom(new Set()) };

    const error = await assertCatalogExists(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).reason).toBe('catalog-missing');
    expect((error as StageInputMissingError).stage).toBe('plan');
    expect((error as StageInputMissingError).resource).toBe('work/catalog.json');
    expect((error as StageInputMissingError).hint).toBe('corré `ingest` antes de `plan`');
  });

  it('resolves when work/catalog.json exists', async () => {
    const deps = { statFile: statFileFrom(new Set([`${fixtureMediaProject.workDir}/catalog.json`])) };

    await expect(assertCatalogExists(fixtureMediaProject, deps)).resolves.toBeUndefined();
  });
});

describe('assertTimelineExists', () => {
  it('throws timeline-missing with the hint to run plan first', async () => {
    const deps = { statFile: statFileFrom(new Set()) };

    const error = await assertTimelineExists(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).reason).toBe('timeline-missing');
    expect((error as StageInputMissingError).stage).toBe('render');
    expect((error as StageInputMissingError).resource).toBe('work/timeline.json');
    expect((error as StageInputMissingError).hint).toBe('corré `plan` antes de `render`');
  });

  it('resolves when work/timeline.json exists', async () => {
    const deps = { statFile: statFileFrom(new Set([`${fixtureMediaProject.workDir}/timeline.json`])) };

    await expect(assertTimelineExists(fixtureMediaProject, deps)).resolves.toBeUndefined();
  });
});
