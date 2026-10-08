import { describe, expect, it } from 'vitest';

import { appendCreditsOnce, creditsPathFor } from './publish-credits';

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
