import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { VideoStepsRail } from './video-steps-rail';

function renderRail(pathname: string, isMotion = false) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <VideoStepsRail slug="demo" title="Demo" isMotion={isMotion} statusByPath={{ '/library': 'ok', '/voice': 'warn' }} />
    </MemoryRouter>,
  );
}

describe('VideoStepsRail', () => {
  it('gives every step an accessible name with its status and the same tooltip', () => {
    renderRail('/projects/demo');
    const nav = screen.getByRole('navigation', { name: 'Video steps: Demo' });

    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'producer (pending)',
      'library (ready)',
      'storyboard (pending)',
      'voice (needs attention)',
      'preview (pending)',
    ]);
    links.forEach((link) => expect(link.getAttribute('title')).toBe(link.getAttribute('aria-label')));
  });

  it('marks the open step as the current page and exposes each status', () => {
    renderRail('/projects/demo/voice');

    expect(screen.getByRole('link', { name: 'voice (needs attention)' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'producer (pending)' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'library (ready)' }).getAttribute('data-status')).toBe('ok');
  });

  it('includes the motion step for a motion video', () => {
    renderRail('/projects/demo', true);

    expect(screen.getAllByRole('link')).toHaveLength(6);
  });
});
