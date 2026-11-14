import type { StoryboardDocument, StoryboardFormat } from '@video-maker/timeline-core';

import {
  STORYBOARD_FORMATS,
  formatTags,
  setStoryboardHeader,
  setStoryboardMusicTags,
} from '../api/storyboard-edit/storyboard-document';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, FIELD_LABEL_CLASS } from './ui/cl-controls';

export type StoryboardHeaderEditorProps = {
  storyboard: StoryboardDocument;
  onChange: (next: StoryboardDocument) => void;
};

export function StoryboardHeaderEditor({ storyboard, onChange }: StoryboardHeaderEditorProps) {
  const t = useT();

  return (
    <section
      data-testid="storyboard-header-editor"
      className="glass grid gap-3 rounded-[20px] p-4 sm:grid-cols-2"
    >
      <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)] sm:col-span-2">
        {t('storyboardHeader.heading')}
      </h2>
      <label className={`flex flex-col gap-1 sm:col-span-2 ${FIELD_LABEL_CLASS}`}>
        {t('storyboardHeader.title')}
        <input
          value={storyboard.title}
          onChange={(event) => onChange(setStoryboardHeader(storyboard, 'title', event.target.value))}
          className={FIELD_CLASS}
        />
      </label>

      <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
        {t('storyboardHeader.language')}
        <input
          value={storyboard.language}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'language', event.target.value))
          }
          className={`${FIELD_CLASS} font-data`}
        />
      </label>

      <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
        {t('storyboardHeader.format')}
        <select
          aria-label={t('storyboardHeader.format')}
          value={storyboard.format}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'format', event.target.value as StoryboardFormat))
          }
          className={`${FIELD_CLASS} font-data`}
        >
          {STORYBOARD_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
      </label>

      <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
        {t('storyboardHeader.captionStyle')}
        <input
          value={storyboard.captionsStyle}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'captionsStyle', event.target.value))
          }
          className={FIELD_CLASS}
        />
      </label>

      <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
        {t('storyboardHeader.musicTags')}
        <input
          value={formatTags(storyboard.musicTags)}
          onChange={(event) => onChange(setStoryboardMusicTags(storyboard, event.target.value))}
          className={`${FIELD_CLASS} font-data`}
        />
      </label>

      <p className="m-0 text-xs text-[var(--cl-ink-2)] sm:col-span-2">{t('storyboardHeader.note')}</p>
    </section>
  );
}
