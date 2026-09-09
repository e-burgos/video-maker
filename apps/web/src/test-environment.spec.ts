import { describe, expect, it } from 'vitest';

describe('web test environment', () => {
  it('runs in a DOM environment with a document available', () => {
    const host = document.createElement('div');
    host.textContent = 'studio';
    document.body.append(host);

    expect(document.body.querySelector('div')?.textContent).toBe('studio');
  });
});
