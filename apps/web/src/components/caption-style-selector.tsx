import type { CaptionStyle, CaptionTheme } from '@video-maker/timeline-core';

import {
  DEFAULT_CAPTION_STYLE,
  captionStyleLabelKey,
  captionStyleOptions,
} from '../api/timeline-edit/caption-style';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';

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
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
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
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          {captionStyleOptions(themeToApply !== undefined || captionStyle === 'brand').map((style) => (
            <option key={style} value={style}>
              {t(captionStyleLabelKey(style))}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-500">{t('captionStyle.hint')}</p>
    </div>
  );
}
