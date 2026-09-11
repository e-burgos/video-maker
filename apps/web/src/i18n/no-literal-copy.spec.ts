import { describe, expect, it } from 'vitest';

import { scanLiteralCopy } from './literal-copy-scan';

const SOURCES = import.meta.glob('../{app,components,pages}/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SCANNED = Object.entries(SOURCES)
  .filter(([path]) => !path.endsWith('.spec.tsx'))
  .map(([path, source]) => [path.replace('../', ''), source] as const)
  .sort(([left], [right]) => left.localeCompare(right));

describe('no literal copy in the rendered tree', () => {
  it('scans every page and component of the studio', () => {
    const paths = SCANNED.map(([path]) => path);

    expect(paths.length).toBeGreaterThan(40);
    expect(paths).toContain('app/app.tsx');
    expect(paths).toContain('pages/guide-page.tsx');
    expect(paths).toContain('components/studio-layout.tsx');
  });

  it.each(SCANNED.map(([path]) => path))(
    'renders %s through the translation catalog only',
    (path) => {
      const source = SCANNED.find(([candidate]) => candidate === path)?.[1] ?? '';

      expect(scanLiteralCopy(source)).toEqual([]);
    },
  );
});
