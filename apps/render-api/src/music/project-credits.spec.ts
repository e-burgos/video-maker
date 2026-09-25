import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { appendMediaCredit, appendMusicCredit } from './project-credits';
import type { MediaCreditEntry, MusicCreditEntry } from './project-credits';

const PROJECT_ROOT = '/media/pitch-deck';

function project() {
  return resolveMediaProject(PROJECT_ROOT);
}

const ENTRY: MusicCreditEntry = {
  kind: 'music',
  path: 'raw/audio/calm-piano.mp3',
  title: 'Calm Piano',
  author: 'Jane Doe',
  license: 'CC BY 3.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
  importedAt: '2026-09-23T00:00:00.000Z',
};

describe('appendMusicCredit', () => {
  it('creates work/credits.json when it does not exist yet', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });

    await appendMusicCredit(storage, project(), ENTRY);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([ENTRY]);
  });

  it('keeps existing entries and appends the new one', async () => {
    const callLog = createCallLog();
    const existing: MusicCreditEntry = { ...ENTRY, path: 'raw/audio/other.mp3', title: 'Other Track' };
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/credits.json`, contents: JSON.stringify([existing]) }],
    });

    await appendMusicCredit(storage, project(), ENTRY);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([existing, ENTRY]);
  });

  it('starts fresh when the existing file is corrupt JSON', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/credits.json`, contents: 'not valid json' }],
    });

    await appendMusicCredit(storage, project(), ENTRY);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([ENTRY]);
  });

  it('two appends in sequence both survive', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const second: MusicCreditEntry = { ...ENTRY, path: 'raw/audio/second.mp3', title: 'Second Track' };

    await appendMusicCredit(storage, project(), ENTRY);
    await appendMusicCredit(storage, project(), second);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([ENTRY, second]);
  });
});

describe('appendMediaCredit', () => {
  it('keeps music, video and image entries together in the same file', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const video: MediaCreditEntry = {
      kind: 'video',
      path: 'raw/broll/ocean.mp4',
      title: 'Ocean Waves',
      author: 'Jane Doe',
      license: 'CC BY 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.mp4',
      importedAt: '2026-09-25T00:00:00.000Z',
    };
    const image: MediaCreditEntry = {
      kind: 'image',
      path: 'raw/images/nebula.jpg',
      title: 'Nebula',
      author: 'NASA',
      license: 'NASA (public domain, NASA media usage guidelines)',
      sourceUrl: 'https://images.nasa.gov/details/PIA1',
      importedAt: '2026-09-25T00:00:00.000Z',
    };

    await appendMediaCredit(storage, project(), ENTRY);
    await appendMediaCredit(storage, project(), video);
    await appendMediaCredit(storage, project(), image);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([ENTRY, video, image]);
  });

  it('drops a stored entry with an unknown kind when reading the file back', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [
        {
          path: `${PROJECT_ROOT}/work/credits.json`,
          contents: JSON.stringify([{ ...ENTRY, kind: 'unknown-kind' }]),
        },
      ],
    });

    await appendMediaCredit(storage, project(), ENTRY);

    const raw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(raw)).toEqual([ENTRY]);
  });
});
