import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  ProducerWelcome,
  STARTER_KEYS_WITHOUT_MATERIAL,
  STARTER_KEYS_WITH_MATERIAL,
  inventoryOf,
} from './producer-welcome';
import type { AssetListing } from '../api/render-api-types';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';

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

    fireEvent.click(screen.getByRole('button', { name: 'Make a 30 s video about…' }));

    expect(onDraft).toHaveBeenCalledWith('Make a 30 s video about ');
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

describe('ProducerWelcome starters (FIX-e-burgos-007-002)', () => {
  it('asks for the platform before anything else, in both inventory states', () => {
    expect(STARTER_KEYS_WITH_MATERIAL[0]).toBe('producer.starter.platform');
    expect(STARTER_KEYS_WITHOUT_MATERIAL[0]).toBe('producer.starter.platform');
    expect(MESSAGES_EN['producer.starter.platform']).toContain('which platform');
    expect(MESSAGES_ES['producer.starter.platform']).toContain('qué plataforma');
  });

  it('offers the silent-recording recipe once there is material to work with', () => {
    expect(STARTER_KEYS_WITH_MATERIAL).toContain('producer.starter.narrate');
    expect(STARTER_KEYS_WITHOUT_MATERIAL).not.toContain('producer.starter.narrate');
  });

  it('offers every starter in both languages, since a chip becomes a message to the agent', () => {
    for (const key of [...STARTER_KEYS_WITH_MATERIAL, ...STARTER_KEYS_WITHOUT_MATERIAL]) {
      expect(MESSAGES_EN[key]).toBeTruthy();
      expect(MESSAGES_ES[key]).toBeTruthy();
      expect(MESSAGES_ES[key]).not.toBe(MESSAGES_EN[key]);
    }
  });
});
