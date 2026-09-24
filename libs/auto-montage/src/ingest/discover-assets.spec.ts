import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { ProjectLayoutError } from '../errors/project-layout-error';
import { resolveMediaProject } from '../project/media-project';
import { discoverAssets } from './discover-assets';

const project = resolveMediaProject('/tmp/media/pitch-deck');

function fakeDependencies(files: Parameters<typeof createFakeFileSystem>[0]) {
  const fakeFileSystem = createFakeFileSystem(files);
  return {
    readDirectory: fakeFileSystem.directoryReader,
    statFile: fakeFileSystem.fileStatReader,
  };
}

describe('discoverAssets', () => {
  it('CA-001: clasifica cada subcarpeta y reporta oculto y extensión no soportada como ignorados', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/audio/music01.mp3', contents: 'a', sizeBytes: 10, modifiedAtMs: 1 },
      { path: '/tmp/media/pitch-deck/raw/images/photo01.jpg', contents: 'b', sizeBytes: 20, modifiedAtMs: 2 },
      { path: '/tmp/media/pitch-deck/raw/broll/notes.txt', contents: 'c' },
      { path: '/tmp/media/pitch-deck/raw/aroll/.DS_Store', contents: 'd' },
      { path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4', contents: 'e', sizeBytes: 30, modifiedAtMs: 3 },
      { path: '/tmp/media/pitch-deck/raw/broll/clip02.mov', contents: 'f', sizeBytes: 40, modifiedAtMs: 4 },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.findings).toEqual([
      { relativePath: 'raw/aroll/clip01.mp4', role: 'aroll', fingerprint: { sizeBytes: 30, modifiedAtMs: 3 } },
      { relativePath: 'raw/audio/music01.mp3', role: 'audio', fingerprint: { sizeBytes: 10, modifiedAtMs: 1 } },
      { relativePath: 'raw/broll/clip02.mov', role: 'broll', fingerprint: { sizeBytes: 40, modifiedAtMs: 4 } },
      { relativePath: 'raw/images/photo01.jpg', role: 'image', fingerprint: { sizeBytes: 20, modifiedAtMs: 2 } },
    ]);
    expect(result.ignored).toEqual([
      { path: 'raw/aroll/.DS_Store', reason: 'hidden' },
      { path: 'raw/broll/notes.txt', reason: 'unsupported-extension' },
    ]);
  });

  it('preserva el anidamiento dentro de una subcarpeta de rol', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/broll/city/skyline.mov', contents: 'x' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.findings).toEqual([
      {
        relativePath: 'raw/broll/city/skyline.mov',
        role: 'broll',
        fingerprint: { sizeBytes: 1, modifiedAtMs: 0 },
      },
    ]);
  });

  it('ignora una carpeta desconocida en raw/ como unknown-directory sin recorrerla', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/scratch/whatever.mp4', contents: 'z' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.findings).toEqual([]);
    expect(result.ignored).toEqual([{ path: 'raw/scratch', reason: 'unknown-directory' }]);
  });

  it('ignora raw/inbox sin recorrerla: la bandeja de entrada nunca es un rol del catálogo', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/inbox/dropped.mp4', contents: 'z' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.findings).toEqual([]);
    expect(result.ignored).toEqual([{ path: 'raw/inbox', reason: 'unknown-directory' }]);
  });

  it('ignora un archivo suelto directamente bajo raw/ como unexpected-file', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4', contents: 'x' },
      { path: '/tmp/media/pitch-deck/raw/README.md', contents: 'stray' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.ignored).toContainEqual({ path: 'raw/README.md', reason: 'unexpected-file' });
  });

  it('ignora un video dentro de images/ y un audio dentro de aroll/ como extension-role-mismatch', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/images/demo.mp4', contents: 'x' },
      { path: '/tmp/media/pitch-deck/raw/aroll/tema.mp3', contents: 'y' },
      { path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4', contents: 'z' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.ignored).toEqual([
      { path: 'raw/aroll/tema.mp3', reason: 'extension-role-mismatch' },
      { path: 'raw/images/demo.mp4', reason: 'extension-role-mismatch' },
    ]);
    expect(result.findings).toEqual([
      { relativePath: 'raw/aroll/clip01.mp4', role: 'aroll', fingerprint: { sizeBytes: 1, modifiedAtMs: 0 } },
    ]);
  });

  it('salta silenciosamente una carpeta oculta bajo raw/ sin recorrer su contenido', async () => {
    const deps = fakeDependencies([
      { path: '/tmp/media/pitch-deck/raw/.git/config', contents: 'x' },
      { path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4', contents: 'y' },
    ]);

    const result = await discoverAssets(project, deps);

    expect(result.findings).toEqual([
      { relativePath: 'raw/aroll/clip01.mp4', role: 'aroll', fingerprint: { sizeBytes: 1, modifiedAtMs: 0 } },
    ]);
    expect(result.ignored).toEqual([]);
  });

  it('lanza ProjectLayoutError si raw/ no existe', async () => {
    const deps = fakeDependencies([]);

    await expect(discoverAssets(project, deps)).rejects.toThrow(ProjectLayoutError);
  });

  it('produce el mismo catalogo determinista sin importar el orden de descubrimiento', async () => {
    const filesInOrder = [
      { path: '/tmp/media/pitch-deck/raw/broll/clip02.mov', contents: 'a' },
      { path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4', contents: 'b' },
      { path: '/tmp/media/pitch-deck/raw/audio/music01.mp3', contents: 'c' },
    ];
    const filesReversed = [...filesInOrder].reverse();

    const resultInOrder = await discoverAssets(project, fakeDependencies(filesInOrder));
    const resultReversed = await discoverAssets(project, fakeDependencies(filesReversed));

    expect(resultInOrder.findings.map((finding) => finding.relativePath)).toEqual(
      resultReversed.findings.map((finding) => finding.relativePath),
    );
    expect(resultInOrder.findings.map((finding) => finding.relativePath)).toEqual([
      'raw/aroll/clip01.mp4',
      'raw/audio/music01.mp3',
      'raw/broll/clip02.mov',
    ]);
  });
});
