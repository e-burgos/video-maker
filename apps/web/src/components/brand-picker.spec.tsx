import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { brandSummary } from '../api/__fixtures__/brand';
import { BrandPicker } from './brand-picker';

const BRANDS = [
  brandSummary({ id: 'acme', name: 'Acme' }),
  brandSummary({ id: 'plain', name: 'Plain', logo: null, palette: null }),
];

function renderPicker(props: Partial<React.ComponentProps<typeof BrandPicker>> = {}) {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <BrandPicker brands={BRANDS} value={null} onChange={onChange} {...props} />
    </MemoryRouter>,
  );
  return onChange;
}

describe('BrandPicker', () => {
  it('shows each brand with its logo thumbnail and palette swatches', () => {
    renderPicker();

    expect(screen.getByAltText('Logo of Acme').getAttribute('src')).toContain('/brands/acme/files/img/logo.svg');
    expect(screen.getByTestId('brand-picker-swatch-acme-accent').getAttribute('style')).toContain('rgb(14, 165, 233)');
    expect(screen.queryByAltText('Logo of Plain')).toBeNull();
    expect(screen.queryByTestId('brand-picker-swatch-plain-accent')).toBeNull();
  });

  it('reports the chosen brand and marks the current one', () => {
    const onChange = renderPicker({ value: 'plain' });

    expect((screen.getByRole('radio', { name: 'Plain' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Acme' }));

    expect(onChange).toHaveBeenCalledWith('acme');
  });

  it('offers the no-brand option only where it applies', () => {
    const onChange = renderPicker({ allowNone: true, value: 'acme' });

    fireEvent.click(screen.getByRole('radio', { name: 'No brand' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('has no no-brand option by default', () => {
    renderPicker();

    expect(screen.queryByRole('radio', { name: 'No brand' })).toBeNull();
  });

  it('links to the brands page and explains an empty library', () => {
    renderPicker({ brands: [] });

    expect(screen.getByTestId('brand-picker-manage').getAttribute('href')).toBe('/brands');
    expect(screen.getByText('There are no brands yet.')).toBeTruthy();
  });

  it('disables every option while a change is saving', () => {
    renderPicker({ disabled: true });

    expect((screen.getByRole('radio', { name: 'Acme' }) as HTMLInputElement).disabled).toBe(true);
  });
});
