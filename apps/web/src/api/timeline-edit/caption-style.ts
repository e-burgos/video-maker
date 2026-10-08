import { CAPTION_STYLES } from '@video-maker/timeline-core';
import type { CaptionStyle, CaptionTheme, Timeline } from '@video-maker/timeline-core';

import type { TranslationKey } from '../../i18n/messages-en';

export const CAPTION_STYLE_OPTIONS: readonly CaptionStyle[] = CAPTION_STYLES;

const LABEL_KEY_BY_STYLE: Readonly<Record<CaptionStyle, TranslationKey>> = {
  'bold-impact': 'captionStyle.boldImpact',
  'clean-sans': 'captionStyle.cleanSans',
  'outline-pop': 'captionStyle.outlinePop',
  'subtle-lower': 'captionStyle.subtleLower',
  brand: 'captionStyle.brand',
  off: 'captionStyle.off',
};

export function captionStyleLabelKey(style: CaptionStyle): TranslationKey {
  return LABEL_KEY_BY_STYLE[style];
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = 'bold-impact';

export function captionStyleOptions(brandAvailable: boolean): readonly CaptionStyle[] {
  return brandAvailable ? CAPTION_STYLE_OPTIONS : CAPTION_STYLE_OPTIONS.filter((style) => style !== 'brand');
}

export function setTimelineCaptionStyle(
  timeline: Timeline,
  captionStyle: CaptionStyle,
  captionTheme?: CaptionTheme,
): Timeline {
  return captionStyle === 'brand' && captionTheme !== undefined
    ? { ...timeline, captionStyle, captionTheme }
    : { ...timeline, captionStyle };
}
