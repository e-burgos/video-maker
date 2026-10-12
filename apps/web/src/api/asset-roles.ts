import { ASSET_ROLES } from './render-api-types';
import type { AssetRole } from './render-api-types';
import type { TranslationKey } from '../i18n/messages-en';

export type AssetRoleCopy = {
  role: AssetRole;
  nameKey: TranslationKey;
  shortNameKey: TranslationKey;
  impactKey: TranslationKey;
  required: boolean;
};

export const BROLL_MATCHING_HINT_KEY: TranslationKey = 'assetRole.brollHint';

const REQUIRED_ROLES: readonly AssetRole[] = ['aroll'];

const IMPORTANCE: readonly AssetRole[] = ['aroll', 'broll', 'image', 'audio', 'voice', 'logo', 'reference'];

export function assetRoleCopy(role: AssetRole): AssetRoleCopy {
  return {
    role,
    nameKey: `assetRole.${role}.name` as TranslationKey,
    shortNameKey: `assetRole.${role}.short` as TranslationKey,
    impactKey: `assetRole.${role}.impact` as TranslationKey,
    required: REQUIRED_ROLES.includes(role),
  };
}

export function isKnownAssetRole(role: string): role is AssetRole {
  return (ASSET_ROLES as readonly string[]).includes(role);
}

export function orderedAssetRoles(
  offered: readonly AssetRole[] = ASSET_ROLES,
): readonly AssetRoleCopy[] {
  return IMPORTANCE.filter((role) => offered.includes(role)).map(assetRoleCopy);
}
