import { describe, expect, it } from 'vitest';

import { MESSAGES_EN } from './messages-en';
import type { Messages, TranslationKey } from './messages-en';
import { interpolate, translate, translatePlural } from './translate';

const CATALOG = {
  ...MESSAGES_EN,
  'health.ok': 'servicio ok · ciclo {cycle}',
} as unknown as Messages;

describe('interpolate', () => {
  it('replaces every named placeholder with its value', () => {
    expect(interpolate('jobs · {running} running · {queued} queued', { running: 1, queued: 4 })).toBe(
      'jobs · 1 running · 4 queued',
    );
  });

  it('leaves a placeholder untouched when the caller did not pass it', () => {
    expect(interpolate('service unreachable ({code})')).toBe('service unreachable ({code})');
    expect(interpolate('service unreachable ({code})', { other: 'x' })).toBe(
      'service unreachable ({code})',
    );
  });

  it('replaces every occurrence of the same placeholder', () => {
    expect(interpolate('{slug} · {slug}', { slug: 'demo' })).toBe('demo · demo');
  });
});

describe('translate', () => {
  it('reads the active catalog, not the english one', () => {
    expect(translate(CATALOG, 'health.ok', { cycle: 7 })).toBe('servicio ok · ciclo 7');
  });

  it('falls back to the raw key when the active catalog lacks it: real catalogs never do, parity is enforced elsewhere', () => {
    const partial = { 'projects.title': 'Proyectos' } as unknown as Messages;

    expect(translate(partial, 'projects.title')).toBe('Proyectos');
    expect(translate(partial, 'projects.loading')).toBe('projects.loading');
  });

  it('never renders undefined for a key no catalog carries', () => {
    const unknown = 'nothing.here' as TranslationKey;

    expect(translate({} as Messages, unknown)).toBe('nothing.here');
  });
});

describe('translatePlural', () => {
  const catalog = {
    ...MESSAGES_EN,
    'test.assets.one': '{count} asset',
    'test.assets.other': '{count} assets',
  } as unknown as Messages;
  const base = 'test.assets' as never;

  it('picks the singular variant only for exactly one', () => {
    expect(translatePlural(catalog, base, 1)).toBe('1 asset');
  });

  it('picks the plural variant for zero and for many', () => {
    expect(translatePlural(catalog, base, 0)).toBe('0 assets');
    expect(translatePlural(catalog, base, 12)).toBe('12 assets');
  });

  it('lets the caller add more placeholders next to the count', () => {
    const withRole = {
      ...catalog,
      'test.assets.other': '{count} {role} assets',
    } as unknown as Messages;

    expect(translatePlural(withRole, base, 3, { role: 'b-roll' })).toBe('3 b-roll assets');
  });
});
