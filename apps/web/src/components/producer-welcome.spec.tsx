import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProducerWelcome, inventoryOf } from './producer-welcome';
import type { AssetListing } from '../api/render-api-types';

function listing(roles: string[]): AssetListing {
  return {
    slug: 'demo-01',
    source: 'catalog',
    assets: roles.map((role, index) => ({
      path: `raw/${role}/file-${index}.mp4`,
      role: role as AssetListing['assets'][number]['role'],
      fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
      media: null,
    })),
    probeFailures: [],
  };
}

function renderWelcome(assets: AssetListing | null) {
  const onDraft = vi.fn();

  render(
    <MemoryRouter>
      <ProducerWelcome slug="demo-01" assets={assets} onDraft={onDraft} />
    </MemoryRouter>,
  );

  return onDraft;
}

describe('inventoryOf', () => {
  it('counts the assets by role in the order of the contract', () => {
    expect(inventoryOf(listing(['broll', 'aroll', 'broll', 'audio']))).toEqual([
      { role: 'aroll', count: 1 },
      { role: 'broll', count: 2 },
      { role: 'audio', count: 1 },
    ]);
  });

  it('shows a role the client does not model yet instead of dropping it', () => {
    expect(inventoryOf(listing(['aroll', 'logo']))).toEqual([
      { role: 'aroll', count: 1 },
      { role: 'logo', count: 1 },
    ]);
  });

  it('reports nothing while the listing has not arrived', () => {
    expect(inventoryOf(null)).toEqual([]);
  });
});

describe('ProducerWelcome', () => {
  it('shows the real inventory of the project', () => {
    renderWelcome(listing(['aroll', 'aroll', 'audio']));

    const inventory = screen.getByTestId('producer-inventory');
    expect(inventory.querySelector('[data-role="aroll"]')?.textContent).toBe('aroll · 2');
    expect(inventory.querySelector('[data-role="audio"]')?.textContent).toBe('audio · 1');
  });

  it('drops a starter into the composer instead of sending it, so it can be finished', () => {
    const onDraft = renderWelcome(listing(['aroll']));

    fireEvent.click(screen.getByRole('button', { name: 'Hacé un video de 30 s sobre…' }));

    expect(onDraft).toHaveBeenCalledWith('Hacé un video de 30 s sobre ');
  });

  it('offers the four starters of a project that has material', () => {
    renderWelcome(listing(['aroll']));

    expect(screen.getByTestId('producer-starters').querySelectorAll('button')).toHaveLength(4);
  });

  it('sends the user to the library when the project has no material at all', () => {
    renderWelcome(listing([]));

    expect(screen.getByRole('link', { name: /Upload your clips/ }).getAttribute('href')).toBe(
      '/projects/demo-01',
    );
    expect(screen.getByTestId('producer-starters').querySelectorAll('button')).toHaveLength(2);
  });

  it('does not promise an inventory it does not have yet', () => {
    renderWelcome(null);

    expect(screen.getByTestId('producer-inventory').textContent).toContain('No raw material yet');
  });
});
