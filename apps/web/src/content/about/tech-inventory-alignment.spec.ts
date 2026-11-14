// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { DISTRIBUTION_LABELS, TECH_CATEGORIES, TECH_INVENTORY } from './tech-inventory';

const PUBLIC_INVENTORY_URL = new URL('../../../../docs-site/src/tech-inventory.mjs', import.meta.url).href;
const publicInventory = (await import(/* @vite-ignore */ PUBLIC_INVENTORY_URL)) as {
  TECH_ITEMS: readonly PublicItem[];
  TECH_CATEGORIES: readonly { id: string }[];
  DISTRIBUTION_KINDS: readonly string[];
};

type PublicItem = {
  id: string;
  name: string;
  category: string;
  version?: string;
  distribution: string;
  license: string | { es: string; en: string };
};

const PUBLIC_ITEMS = publicInventory.TECH_ITEMS;
const PUBLIC_CATEGORIES = publicInventory.TECH_CATEGORIES;

function licenseIn(item: PublicItem, locale: 'es' | 'en'): string {
  return typeof item.license === 'string' ? item.license : item.license[locale];
}

describe('app technology inventory against the public site', () => {
  it('lists the same components in the same order', () => {
    expect(TECH_INVENTORY.map((item) => item.id)).toEqual(PUBLIC_ITEMS.map((item) => item.id));
  });

  it('keeps name, version, category and distribution of every component', () => {
    for (const publicItem of PUBLIC_ITEMS) {
      const own = TECH_INVENTORY.find((item) => item.id === publicItem.id);
      expect(own?.name, publicItem.id).toBe(publicItem.name);
      expect(own?.version, publicItem.id).toBe(publicItem.version ?? null);
      expect(own?.category, publicItem.id).toBe(publicItem.category);
      expect(own?.distribution, publicItem.id).toBe(publicItem.distribution);
    }
  });

  it('keeps the license of every component in both languages', () => {
    for (const publicItem of PUBLIC_ITEMS) {
      const own = TECH_INVENTORY.find((item) => item.id === publicItem.id);
      expect(own?.license.es, publicItem.id).toBe(licenseIn(publicItem, 'es'));
      expect(own?.license.en, publicItem.id).toBe(licenseIn(publicItem, 'en'));
    }
  });

  it('keeps the same categories and distribution kinds', () => {
    expect(TECH_CATEGORIES.map((category) => category.id)).toEqual(PUBLIC_CATEGORIES.map((category) => category.id));
    expect(Object.keys(DISTRIBUTION_LABELS)).toEqual(publicInventory.DISTRIBUTION_KINDS);
  });

  it('describes every component in both languages', () => {
    for (const item of TECH_INVENTORY) {
      expect(item.what.es.length, item.id).toBeGreaterThan(0);
      expect(item.what.en.length, item.id).toBeGreaterThan(0);
    }
  });
});
