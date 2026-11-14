import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../../api/render-api-context';
import { ThemeProvider } from '../../theme/theme-context';
import { FOOTER_CONTROL_CLASS } from './footer-control-style';
import { SidebarFooter } from './sidebar-footer';
import type { RenderApiClient } from '../../api/render-api-client';

function renderFooter() {
  const client = { getHealth: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as RenderApiClient;
  return render(
    <ThemeProvider>
      <RenderApiProvider client={client}>
        <MemoryRouter>
          <SidebarFooter />
        </MemoryRouter>
      </RenderApiProvider>
    </ThemeProvider>,
  );
}

describe('SidebarFooter', () => {
  it('has a single status control that opens the details, instead of a recheck pill plus a details button', async () => {
    renderFooter();
    const footer = within(screen.getByTestId('sidebar-footer'));

    await waitFor(() =>
      expect(screen.getByTestId('service-health-trigger').getAttribute('aria-label')).toMatch(/, details$/),
    );
    expect(footer.getAllByRole('button', { name: /details$/ })).toHaveLength(1);
    expect(screen.queryByTestId('service-health-recheck')).toBeNull();

    fireEvent.click(screen.getByTestId('service-health-trigger'));
    expect(screen.getByTestId('service-health-recheck')).toBeTruthy();
  });

  it('keeps the language switch as two pressed-aware options inside the footer', () => {
    renderFooter();

    const options = within(screen.getByTestId('language-switch'))
      .getAllByRole('button')
      .filter((option) => option.hasAttribute('data-language'));
    expect(options.map((option) => option.getAttribute('data-language'))).toEqual(['en', 'es']);
    expect(options.filter((option) => option.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('exposes the status as a titled dot-only control in the rail, label hidden by css only', () => {
    renderFooter();
    const trigger = screen.getByTestId('service-health-trigger');

    expect(trigger.getAttribute('title')).not.toBeNull();
    expect(trigger.className).toContain('max-[1099px]:size-8');
    expect(screen.getByTestId('service-health-label').className).toContain('max-[1099px]:hidden');
  });

  it('links the appearance entry straight to the appearance tab of the settings, with the height of the status control', () => {
    renderFooter();
    const link = screen.getByTestId('appearance-link');

    expect(link.getAttribute('href')).toBe('/settings?tab=appearance');
    expect(link.className).toContain(FOOTER_CONTROL_CLASS);
    expect(screen.getByTestId('service-health-trigger').className).toContain(FOOTER_CONTROL_CLASS);
    expect(link.className).toContain('py-2');
    expect(screen.queryByTestId('appearance-toggle')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
