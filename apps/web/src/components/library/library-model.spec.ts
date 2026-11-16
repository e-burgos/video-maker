import { describe, expect, it } from 'vitest';

import {
  filterAssets,
  filterableRoles,
  flaggedAssetPaths,
  orderAssetsByRole,
  pruneSelection,
  roleSummary,
  toggleSelection,
} from './library-model';
import type { AssetListEntry, AssetRole } from '../../api/render-api-types';

function asset(path: string, role: AssetRole): AssetListEntry {
  return {
    path,
    role,
    fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
    media: null,
  };
}

const ASSETS = [
  asset('raw/images/p.jpg', 'image'),
  asset('raw/aroll/a.mp4', 'aroll'),
  asset('raw/logo/l.png', 'logo'),
];
const ROLES: AssetRole[] = [
  'aroll',
  'broll',
  'image',
  'audio',
  'voice',
  'logo',
  'reference',
];

describe('library model', () => {
  it('orders assets by role importance and filters by role', () => {
    expect(orderAssetsByRole(ASSETS, ROLES).map((entry) => entry.role)).toEqual(
      ['aroll', 'image', 'logo'],
    );
    expect(filterAssets(ASSETS, 'logo')).toHaveLength(1);
    expect(filterAssets(ASSETS, 'all')).toHaveLength(3);
    expect(filterableRoles(ASSETS, ROLES)).toEqual(['aroll', 'image', 'logo']);
  });

  it('summarizes complete, missing, empty and review roles and hides empty voice and reference', () => {
    const flagged = flaggedAssetPaths({
      items: [
        {
          file: 'images/p.jpg',
          source: 'project',
          shows: 's',
          verdict: 'unfit',
          reason: 'r',
        },
      ],
      gaps: [],
    });
    const summary = roleSummary(ASSETS.slice(0, 1), ROLES, 'aroll', flagged);

    expect(summary.find((entry) => entry.role === 'image')?.status).toBe(
      'review',
    );
    expect(summary.find((entry) => entry.role === 'aroll')?.status).toBe(
      'missing',
    );
    expect(summary.find((entry) => entry.role === 'broll')?.status).toBe(
      'empty',
    );
    expect(
      summary.some(
        (entry) => entry.role === 'voice' || entry.role === 'reference',
      ),
    ).toBe(false);
    expect(
      roleSummary(ASSETS, ROLES, 'aroll', new Set()).find(
        (entry) => entry.role === 'aroll',
      )?.status,
    ).toBe('complete');
  });

  it('toggles and prunes the selection', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
    expect(pruneSelection(['raw/aroll/a.mp4', 'gone'], ASSETS)).toEqual([
      'raw/aroll/a.mp4',
    ]);
  });
});
