import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../../api/render-api-context';
import type { RenderApiClient } from '../../api/render-api-client';
import { ThemeProvider } from '../../theme/theme-context';
import { ShellSidebar } from './shell-sidebar';
import { VideoStepsNav } from './video-steps-nav';

function renderSidebar(pathname: string, videoBlock: React.ReactNode = null) {
  const client = { getHealth: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as RenderApiClient;
  return render(
    <ThemeProvider>
      <RenderApiProvider client={client}>
        <MemoryRouter initialEntries={[pathname]}>
          <ShellSidebar videoBlock={videoBlock} />
        </MemoryRouter>
      </RenderApiProvider>
    </ThemeProvider>,
  );
}

describe('ShellSidebar', () => {
  it('lists every destination under its section with the right route', () => {
    renderSidebar('/');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    const hrefs = within(nav).getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/brands', '/publish-queue', '/settings', '/learn']);
    expect(within(nav).getByText('Produce')).toBeTruthy();
    expect(within(nav).getByText('Output')).toBeTruthy();
    expect(within(nav).getByText('System')).toBeTruthy();
  });

  it('marks only the open destination as the current page', () => {
    renderSidebar('/brands/acme');

    expect(screen.getByTestId('brands-nav').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('videos-nav').getAttribute('aria-current')).toBeNull();
    expect(screen.getByTestId('settings-nav').getAttribute('aria-current')).toBeNull();
  });

  it('keeps every destination a native focusable link in reading order', () => {
    renderSidebar('/');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    const links = within(nav).getAllByRole('link');
    links.forEach((link) => {
      expect(link.tagName).toBe('A');
      expect(link.tabIndex).toBeGreaterThanOrEqual(0);
    });
    links[1]?.focus();
    expect(document.activeElement).toBe(screen.getByTestId('brands-nav'));
  });

  it('renders the video block right after My videos', () => {
    renderSidebar('/projects/a', <div data-testid="block">block</div>);
    const videos = screen.getByTestId('videos-nav');

    expect(videos.parentElement?.contains(screen.getByTestId('block'))).toBe(true);
    expect(screen.getByTestId('brands-nav').parentElement?.contains(screen.getByTestId('block'))).toBe(false);
  });

  it('carries the brand and the appearance control in the footer', () => {
    renderSidebar('/');

    expect(screen.getByRole('img', { name: 'Video Maker' })).toBeTruthy();
    expect(within(screen.getByTestId('sidebar-footer')).getByText('Appearance')).toBeTruthy();
    expect(screen.getByTestId('language-switch')).toBeTruthy();
  });

  it('shows the real state of each step of the open video inside the video block', () => {
    renderSidebar(
      '/projects/demo',
      <VideoStepsNav slug="demo" title="Demo" isMotion={false} statusByPath={{ '/library': 'ok', '/voice': 'warn' }} />,
    );
    const nav = screen.getByTestId('project-nav');

    expect(within(nav).getByRole('link', { name: 'library' }).getAttribute('data-status')).toBe('ok');
    expect(within(nav).getByRole('link', { name: 'voice' }).getAttribute('data-status')).toBe('warn');
    expect(within(nav).getByRole('link', { name: 'storyboard' }).getAttribute('data-status')).toBe('pending');
  });
});
