import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { PathEscapesProjectError } from '../errors/path-escapes-project-error';
import { ReadOnlyRawPathError } from '../errors/read-only-raw-path-error';
import { resolveMediaProject } from '../project/media-project';
import { toAbsolutePath } from '../project/project-paths';
import { assertWritableProjectPath, guardEnsureDirectory, guardWriteTextFile } from './guard-raw-writes';

const project = resolveMediaProject('/tmp/media/pitch-deck');

describe('assertWritableProjectPath', () => {
  it('no lanza para una ruta bajo work/', () => {
    expect(() =>
      assertWritableProjectPath(project, toAbsolutePath(project, 'work/catalog.json')),
    ).not.toThrow();
  });

  it('lanza ReadOnlyRawPathError para una ruta bajo raw/', () => {
    expect(() =>
      assertWritableProjectPath(project, toAbsolutePath(project, 'raw/aroll/clip01.mp4')),
    ).toThrow(ReadOnlyRawPathError);
  });

  it('lanza PathEscapesProjectError para una ruta fuera del proyecto', () => {
    expect(() =>
      assertWritableProjectPath(project, '/tmp/media/other-project/work/catalog.json'),
    ).toThrow(PathEscapesProjectError);
  });
});

describe('guardWriteTextFile', () => {
  it('delega en el WriteTextFile subyacente para una ruta bajo work/', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const guarded = guardWriteTextFile(project, fakeFileSystem.writeTextFile);
    const targetPath = toAbsolutePath(project, 'work/catalog.json');

    await guarded(targetPath, '{"schemaVersion":1}');

    expect(fakeFileSystem.writtenFiles.get(targetPath)).toBe('{"schemaVersion":1}');
  });

  it('lanza ReadOnlyRawPathError y no invoca al WriteTextFile subyacente para una ruta bajo raw/', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const guarded = guardWriteTextFile(project, fakeFileSystem.writeTextFile);
    const targetPath = toAbsolutePath(project, 'raw/aroll/clip01.mp4');

    await expect(guarded(targetPath, 'malicious')).rejects.toThrow(ReadOnlyRawPathError);
    expect(fakeFileSystem.writtenFiles.size).toBe(0);
  });
});

describe('guardEnsureDirectory', () => {
  it('delega en el EnsureDirectory subyacente para una ruta bajo work/', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const guarded = guardEnsureDirectory(project, fakeFileSystem.ensureDirectory);
    const targetPath = toAbsolutePath(project, 'work/transcripts');

    await guarded(targetPath);

    expect(fakeFileSystem.ensuredDirectories).toEqual([targetPath]);
  });

  it('lanza ReadOnlyRawPathError y no invoca al EnsureDirectory subyacente para una ruta bajo raw/', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const guarded = guardEnsureDirectory(project, fakeFileSystem.ensureDirectory);
    const targetPath = toAbsolutePath(project, 'raw/broll');

    await expect(guarded(targetPath)).rejects.toThrow(ReadOnlyRawPathError);
    expect(fakeFileSystem.ensuredDirectories).toEqual([]);
  });
});
