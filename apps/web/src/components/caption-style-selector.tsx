import type { CaptionStyle } from '@video-maker/timeline-core';

import {
  CAPTION_STYLE_OPTIONS,
  DEFAULT_CAPTION_STYLE,
  captionStyleLabelKey,
} from '../api/timeline-edit/caption-style';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';

export type CaptionStyleSelectorProps = {
  captionStyle?: CaptionStyle;
  dispatch: (action: TimelineEditAction) => void;
};

export function CaptionStyleSelector({ captionStyle, dispatch }: CaptionStyleSelectorProps) {
  const t = useT();

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
          onChange={(event) =>
            dispatch({ type: 'caption-style', captionStyle: event.target.value as CaptionStyle })
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          {CAPTION_STYLE_OPTIONS.map((style) => (
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
