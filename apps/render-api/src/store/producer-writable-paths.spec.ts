import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import {
  MAX_READABLE_PROJECT_TEXT_BYTES,
  READABLE_PROJECT_TEXT_EXTENSIONS,
  assertReadableProjectText,
  assertWritableProjectText,
  resolveProducerPath,
} from './producer-writable-paths';

const PROJECT_ROOT = '/media/pitch-deck';

function project() {
  return resolveMediaProject(PROJECT_ROOT);
}

describe('resolveProducerPath', () => {
  it('resolves a plain project-relative path to its absolute path', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'x' }],
    });

    const resolved = await resolveProducerPath(storage, project(), 'raw/aroll/clip01.mp4');

    expect(resolved).toEqual({
      relativePath: 'raw/aroll/clip01.mp4',
      absolutePath: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`,
    });
  });

  it('resolves a path that does not exist yet, using its nearest existing ancestor', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${PROJECT_ROOT}/work/producer`] });

    const resolved = await resolveProducerPath(storage, project(), 'work/producer/notes.md');

    expect(resolved.absolutePath).toBe(`${PROJECT_ROOT}/work/producer/notes.md`);
  });

  it.each(['/etc/passwd', 'C:\\Users\\x', 'raw\\aroll\\clip01.mp4', 'raw/../etc/passwd', '..', ''])(
    'rejects a syntactically unsafe path (%s) with PATH_OUTSIDE_PROJECT',
    async (unsafePath) => {
      const callLog = createCallLog();
      const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });

      await expect(resolveProducerPath(storage, project(), unsafePath)).rejects.toMatchObject({
        code: 'PATH_OUTSIDE_PROJECT',
      });
    },
  );

  it('rejects a path whose realpath resolves outside the project root (symlink escape)', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
    });
    storage.control.setRealPath(`${PROJECT_ROOT}/raw/aroll/evil-link.mp4`, '/etc/passwd');

    await expect(resolveProducerPath(storage, project(), 'raw/aroll/evil-link.mp4')).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_PROJECT',
    });
  });

  it('rejects a path whose nearest existing ancestor resolves outside the project root', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${PROJECT_ROOT}/work/producer/evil-dir`],
    });
    storage.control.setRealPath(`${PROJECT_ROOT}/work/producer/evil-dir`, '/outside/evil-dir');

    await expect(
      resolveProducerPath(storage, project(), 'work/producer/evil-dir/notes.md'),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('falls back to the syntactic path when nothing in storage resolves via realPath', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);

    const resolved = await resolveProducerPath(storage, project(), 'raw/aroll/clip01.mp4');

    expect(resolved).toEqual({
      relativePath: 'raw/aroll/clip01.mp4',
      absolutePath: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`,
    });
  });

  it('accepts a project root whose own realpath differs syntactically (e.g. a resolved tmp symlink)', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'x' }],
    });
    storage.control.setRealPath(PROJECT_ROOT, '/private/media/pitch-deck');
    storage.control.setRealPath(`${PROJECT_ROOT}/raw/aroll/clip01.mp4`, '/private/media/pitch-deck/raw/aroll/clip01.mp4');

    await expect(
      resolveProducerPath(storage, project(), 'raw/aroll/clip01.mp4'),
    ).resolves.toEqual({
      relativePath: 'raw/aroll/clip01.mp4',
      absolutePath: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`,
    });
  });
});

describe('assertReadableProjectText', () => {
  it.each(READABLE_PROJECT_TEXT_EXTENSIONS)('accepts a %s file under work/', (extension) => {
    expect(() => assertReadableProjectText(`work/producer/notes${extension}`)).not.toThrow();
  });

  it('rejects a disallowed extension under work/', () => {
    expect(() => assertReadableProjectText('work/producer/notes.yaml')).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('rejects a path outside work/', () => {
    expect(() => assertReadableProjectText('raw/aroll/clip01.txt')).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('exposes the 256 KB read limit', () => {
    expect(MAX_READABLE_PROJECT_TEXT_BYTES).toBe(262144);
  });
});

describe('assertWritableProjectText', () => {
  it('accepts a path under work/producer/', () => {
    expect(() => assertWritableProjectText('work/producer/notes.md')).not.toThrow();
  });

  it('accepts exactly work/credits.json', () => {
    expect(() => assertWritableProjectText('work/credits.json')).not.toThrow();
  });

  it('rejects work/credits.json.bak', () => {
    expect(() => assertWritableProjectText('work/credits.json.bak')).toThrow(
      expect.objectContaining({ code: 'PATH_NOT_WRITABLE' }),
    );
  });

  it('rejects a path under raw/', () => {
    expect(() => assertWritableProjectText('raw/aroll/clip01.mp4')).toThrow(
      expect.objectContaining({ code: 'PATH_NOT_WRITABLE' }),
    );
  });

  it('rejects the production proposal, whose approval only the proposal endpoints write', () => {
    expect(() => assertWritableProjectText('work/producer/proposal.json')).toThrow(
      expect.objectContaining({ code: 'PATH_NOT_WRITABLE' }),
    );
  });

  it.each(['work/producer/material-review.json', 'work/producer/viewed-images.json'])('rejects %s, whose evidence only the studio records', (path) => {
    expect(() => assertWritableProjectText(path)).toThrow(expect.objectContaining({ code: 'PATH_NOT_WRITABLE' }));
  });

  it('rejects a path directly under work/, outside work/producer/', () => {
    expect(() => assertWritableProjectText('work/timeline.json')).toThrow(
      expect.objectContaining({ code: 'PATH_NOT_WRITABLE' }),
    );
  });
});
