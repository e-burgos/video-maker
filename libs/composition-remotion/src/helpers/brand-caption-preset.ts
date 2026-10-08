import type { CaptionTheme } from '@video-maker/timeline-core';

import { CAPTION_PRESETS } from './caption-preset';
import type { CaptionPreset } from './caption-preset';

const GENERIC_FALLBACK = 'sans-serif';

export function brandCaptionPreset(theme: CaptionTheme): CaptionPreset {
  const base = CAPTION_PRESETS.brand;
  return {
    ...base,
    fontFamily: `'${theme.fontFamily.replace(/'/gu, '')}', ${GENERIC_FALLBACK}`,
    color: theme.textColor,
    activeColor: theme.textColor,
    emphasisColor: theme.accentColor,
    pill: base.pill === null ? null : { ...base.pill, color: theme.boxColor, emphasisColor: theme.boxColor },
  };
}
