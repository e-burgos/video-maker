import { isFreeCommercialLicense } from '../media-search/commons-shared';

const SHARE_ALIKE_LICENSE = /\bBY[\s-]SA\b/iu;

export function isPublishableMusicLicense(licenseShortName: string | undefined): boolean {
  return isFreeCommercialLicense(licenseShortName) && !SHARE_ALIKE_LICENSE.test(licenseShortName ?? '');
}
