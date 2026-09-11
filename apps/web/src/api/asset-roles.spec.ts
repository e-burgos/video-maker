import { describe, expect, it } from 'vitest';

import { BROLL_MATCHING_HINT_KEY, assetRoleCopy, orderedAssetRoles } from './asset-roles';
import { MESSAGES_EN } from '../i18n/messages-en';
import { ASSET_ROLES } from './render-api-types';

describe('asset role copy (US-016-004)', () => {
  it('describes every role the service accepts, so a new role cannot ship without its copy', () => {
    expect(orderedAssetRoles().map((entry) => entry.role).sort()).toEqual([...ASSET_ROLES].sort());
  });

  it('orders the roles by importance, with A-roll first and the logo last', () => {
    expect(orderedAssetRoles().map((entry) => entry.role)).toEqual([
      'aroll',
      'broll',
      'image',
      'audio',
      'voice',
      'logo',
    ]);
  });

  it('marks A-roll as the only required role', () => {
    expect(orderedAssetRoles().filter((entry) => entry.required).map((entry) => entry.role)).toEqual(
      ['aroll'],
    );
  });

  it('keeps the requested order regardless of the order the caller offers the roles in', () => {
    expect(orderedAssetRoles(['logo', 'aroll']).map((entry) => entry.role)).toEqual([
      'aroll',
      'logo',
    ]);
  });

  it('points every role at a translation key the catalog actually carries', () => {
    for (const entry of orderedAssetRoles()) {
      expect(MESSAGES_EN[entry.nameKey]).toBeTruthy();
      expect(MESSAGES_EN[entry.impactKey]).toBeTruthy();
    }
  });

  it('states for every role what it does to the final video, not just what it is', () => {
    for (const entry of orderedAssetRoles()) {
      expect(MESSAGES_EN[entry.impactKey].length).toBeGreaterThan(40);
      expect(MESSAGES_EN[entry.nameKey]).not.toBe(entry.role);
    }
  });

  it('explains the rule that decides when a B-roll clip is actually used', () => {
    expect(MESSAGES_EN[BROLL_MATCHING_HINT_KEY]).toContain('at least three times');
    expect(MESSAGES_EN[assetRoleCopy('broll').impactKey]).toContain('three times');
  });
});
