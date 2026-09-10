import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyToClipboard } from './clipboard';

function withClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  withClipboard(undefined);
});

describe('copyToClipboard', () => {
  it('writes the text and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });

    expect(await copyToClipboard('01. a prompt')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('01. a prompt');
  });

  it('reports failure instead of throwing when the browser denies the write', async () => {
    withClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });

    expect(await copyToClipboard('01. a prompt')).toBe(false);
  });

  it('reports failure when the page has no clipboard at all', async () => {
    withClipboard(undefined);

    expect(await copyToClipboard('01. a prompt')).toBe(false);
  });
});
