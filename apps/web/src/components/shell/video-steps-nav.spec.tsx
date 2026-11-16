import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { VideoStepsNav } from './video-steps-nav';
import type { VideoStepsNavProps } from './video-steps-nav';

function renderNav(pathname: string, props: Partial<VideoStepsNavProps> = {}) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <VideoStepsNav slug="demo" title="Demo video" isMotion={false} {...props} />
    </MemoryRouter>,
  );
}

function stepHrefs() {
  return screen.getAllByRole('link').map((link) => link.getAttribute('href'));
}

describe('VideoStepsNav', () => {
  it('shows the video title and the five steps of a footage video', () => {
    renderNav('/projects/demo');

    expect(screen.getByText('Demo video')).toBeTruthy();
    expect(stepHrefs()).toEqual([
      '/projects/demo',
      '/projects/demo/library',
      '/projects/demo/storyboard',
      '/projects/demo/voice',
      '/projects/demo/preview',
    ]);
  });

  it('adds the motion step right after the producer for a motion video', () => {
    renderNav('/projects/demo', { isMotion: true });

    expect(stepHrefs().slice(0, 3)).toEqual(['/projects/demo', '/projects/demo/motion', '/projects/demo/library']);
  });

  it('marks the open step and leaves the producer unmarked on a section', () => {
    renderNav('/projects/demo/voice');

    expect(screen.getByRole('link', { name: 'voice' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'producer' }).getAttribute('aria-current')).toBeNull();
  });

  it('defaults every step to pending and reflects the status given per step', () => {
    renderNav('/projects/demo', { statusByPath: { '/voice': 'ok', '/preview': 'warn' } });

    expect(screen.getByRole('link', { name: 'library' }).getAttribute('data-status')).toBe('pending');
    expect(screen.getByRole('link', { name: 'voice' }).getAttribute('data-status')).toBe('ok');
    expect(screen.getByRole('link', { name: 'preview' }).getAttribute('data-status')).toBe('warn');
  });

  it('renders the footer slot outside the step navigation', () => {
    renderNav('/projects/demo', { footer: <button type="button">brand control</button> });

    expect(screen.getByRole('button', { name: 'brand control' })).toBeTruthy();
    expect(screen.getByTestId('project-nav').contains(screen.getByRole('button', { name: 'brand control' }))).toBe(false);
  });
});
