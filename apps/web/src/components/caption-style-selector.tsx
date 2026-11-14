import type { CaptionStyle, CaptionTheme } from '@video-maker/timeline-core';

import {
  DEFAULT_CAPTION_STYLE,
  captionStyleLabelKey,
  captionStyleOptions,
} from '../api/timeline-edit/caption-style';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, INLINE_LABEL_CLASS } from './ui/cl-controls';

export type CaptionStyleSelectorProps = {
  captionStyle?: CaptionStyle;
  captionTheme?: CaptionTheme;
  brandTheme?: CaptionTheme | null;
  dispatch: (action: TimelineEditAction) => void;
};

export function CaptionStyleSelector({ captionStyle, captionTheme, brandTheme = null, dispatch }: CaptionStyleSelectorProps) {
  const t = useT();
  const themeToApply = brandTheme ?? captionTheme;

  return (
    <div
      data-testid="caption-style-selector"
      data-caption-style={captionStyle ?? ''}
      className="flex flex-col gap-2"
    >
      <label className={`${INLINE_LABEL_CLASS} flex-col items-stretch gap-1`}>
        {t('captionStyle.label')}
        <select
          aria-label={t('captionStyle.label')}
          value={captionStyle ?? DEFAULT_CAPTION_STYLE}
          onChange={(event) => {
            const style = event.target.value as CaptionStyle;
            dispatch(
              style === 'brand' && themeToApply !== undefined
                ? { type: 'caption-style', captionStyle: style, captionTheme: themeToApply }
                : { type: 'caption-style', captionStyle: style },
            );
          }}
          className={FIELD_CLASS}
        >
          {captionStyleOptions(themeToApply !== undefined || captionStyle === 'brand').map((style) => (
            <option key={style} value={style}>
              {t(captionStyleLabelKey(style))}
            </option>
          ))}
        </select>
      </label>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('captionStyle.hint')}</p>
    </div>
  );
}
