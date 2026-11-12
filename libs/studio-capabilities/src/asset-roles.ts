export const ASSET_ROLES = ['aroll', 'broll', 'image', 'audio', 'voice', 'logo', 'reference'] as const;

export type AssetRole = (typeof ASSET_ROLES)[number];
