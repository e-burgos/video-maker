import type { FC } from 'react';
import type { CaptionTheme } from '@video-maker/timeline-core';

import { useBrandCaptionFonts } from '../helpers/use-brand-caption-fonts';

export const BrandCaptionFonts: FC<{ theme: CaptionTheme }> = ({ theme }) => {
  useBrandCaptionFonts(theme);
  return null;
};
