import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomeDropHint } from './home-drop-hint';

describe('HomeDropHint', () => {
  it('is a compact, always-visible hint by default', () => {
    render(<HomeDropHint />);

    const hint = screen.getByTestId('home-drop-hint');
    expect(hint.getAttribute('data-hero')).toBe('false');
    expect(hint.textContent).toContain('Drag a video to get started');
  });

  it('renders as a hero when there is nothing on the page yet', () => {
    render(<HomeDropHint hero />);

    expect(screen.getByTestId('home-drop-hint').getAttribute('data-hero')).toBe('true');
  });
});
