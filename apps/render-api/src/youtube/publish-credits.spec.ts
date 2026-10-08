import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { appendCreditsOnce, creditsPathFor, projectCreditsText, readCreditsText } from './publish-credits';

describe('creditsPathFor', () => {
  it('points at the credits text next to the video', () => {
    expect(creditsPathFor('out/video.mp4')).toBe('out/video.credits.txt');
  });
});

describe('appendCreditsOnce', () => {
  it('appends the credits after a blank line', () => {
    expect(appendCreditsOnce('Texto', 'Música: X')).toBe('Texto\n\nMúsica: X');
  });

  it('returns only the credits for an empty description', () => {
    expect(appendCreditsOnce('', 'Música: X')).toBe('Música: X');
  });

  it('keeps the description untouched when it already contains the credits or there are none', () => {
    expect(appendCreditsOnce('Texto\n\nMúsica: X', 'Música: X')).toBe('Texto\n\nMúsica: X');
    expect(appendCreditsOnce('Texto', null)).toBe('Texto');
  });

  it('shortens the description, never the credits, to stay within 5000 characters', () => {
    const result = appendCreditsOnce('d'.repeat(5000), 'Música: X');

    expect(result).toHaveLength(5000);
    expect(result.endsWith('\n\nMúsica: X')).toBe(true);
  });
});

const TUTORIAL_CREDITS = {
  assets: [
    {
      role: 'music',
      file: 'raw/audio/music01.mp3',
      title: 'Inspiring Advertising - Upbeat Summer Corporate',
      artist: 'Rafael Krux',
      source: 'Wikimedia Commons',
      license: 'CC BY 4.0',
    },
  ],
};
const TUTORIAL_LINE = 'Música: "Inspiring Advertising - Upbeat Summer Corporate" Rafael Krux (Wikimedia Commons) · CC BY 4.0';

describe('projectCreditsText', () => {
  it('reads the assets shape the tutorials carry', () => {
    expect(projectCreditsText(TUTORIAL_CREDITS)).toBe(TUTORIAL_LINE);
  });

  it('reads the list shape the music import writes and skips entries without title or license', () => {
    const text = projectCreditsText([
      { kind: 'music', path: 'raw/audio/a.mp3', title: 'Tema', author: 'Autor', license: 'CC BY 4.0', sourceUrl: 'https://x' },
      { kind: 'image', path: 'raw/images/b.jpg', title: '', author: 'Nadie', license: 'CC0' },
    ]);

    expect(text).toBe('Música: "Tema" Autor · CC BY 4.0');
  });

  it('answers null when nothing is creditable', () => {
    expect(projectCreditsText({})).toBeNull();
  });
});

describe('readCreditsText', () => {
  const project = resolveMediaProject('/media/tuto');

  it('falls back to work/credits.json when the video has no sidecar, so footage tutorials keep their music credit', async () => {
    const storage = createFakeObjectStorage(createCallLog(), {
      directories: ['/media/tuto', '/media/tuto/work', '/media/tuto/out'],
      files: [{ path: '/media/tuto/work/credits.json', contents: JSON.stringify(TUTORIAL_CREDITS) }],
    });

    expect(await readCreditsText(storage, project, 'out/render.mp4')).toBe(TUTORIAL_LINE);
  });

  it('prefers the sidecar next to the video', async () => {
    const storage = createFakeObjectStorage(createCallLog(), {
      directories: ['/media/tuto', '/media/tuto/work', '/media/tuto/out'],
      files: [
        { path: '/media/tuto/out/video.credits.txt', contents: 'Música: propia\n' },
        { path: '/media/tuto/work/credits.json', contents: JSON.stringify(TUTORIAL_CREDITS) },
      ],
    });

    expect(await readCreditsText(storage, project, 'out/video.mp4')).toBe('Música: propia');
  });
});
