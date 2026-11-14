import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  YOUTUBE_DESCRIPTION_MAX,
  YOUTUBE_TAGS_MAX_CHARS,
  YOUTUBE_TITLE_MAX,
  addTags,
  removeTag,
  tagsCharCount,
} from '../api/youtube-publish-form';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, FIELD_LABEL_CLASS, TEXTAREA_CLASS } from './ui/cl-controls';
import type { YouTubePublishFormValues } from '../api/youtube-publish-form';

export type YouTubeMetadataFieldsProps = {
  values: YouTubePublishFormValues;
  disabled: boolean;
  onChange: (patch: Partial<YouTubePublishFormValues>) => void;
};

function Counter({ testId, count, max }: { testId: string; count: number; max: number }) {
  return (
    <span
      data-testid={testId}
      data-over={count > max}
      className="font-data text-xs text-[var(--cl-ink-3)] data-[over=true]:text-[var(--tucu-state-red-ink)]"
    >
      {count}/{max}
    </span>
  );
}

const INPUT_CLASS = `${FIELD_CLASS} w-full disabled:opacity-50`;
const AREA_CLASS = `${TEXTAREA_CLASS} w-full disabled:opacity-50`;

export function YouTubeMetadataFields({ values, disabled, onChange }: YouTubeMetadataFieldsProps) {
  const t = useT();
  const [tagDraft, setTagDraft] = useState('');

  function commitTagDraft(): void {
    if (tagDraft.trim() === '') {
      return;
    }
    onChange({ tags: addTags(values.tags, tagDraft) });
    setTagDraft('');
  }

  function onTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTagDraft();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-title" className={FIELD_LABEL_CLASS}>
            {t('youtube.publish.title')}
          </label>
          <Counter testId="youtube-title-counter" count={values.title.length} max={YOUTUBE_TITLE_MAX} />
        </div>
        <input
          id="youtube-title"
          type="text"
          value={values.title}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-description" className={FIELD_LABEL_CLASS}>
            {t('youtube.publish.description')}
          </label>
          <Counter
            testId="youtube-description-counter"
            count={values.description.length}
            max={YOUTUBE_DESCRIPTION_MAX}
          />
        </div>
        <textarea
          id="youtube-description"
          rows={6}
          value={values.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          className={AREA_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-tags" className={FIELD_LABEL_CLASS}>
            {t('youtube.publish.tags')}
          </label>
          <Counter
            testId="youtube-tags-counter"
            count={tagsCharCount(values.tags)}
            max={YOUTUBE_TAGS_MAX_CHARS}
          />
        </div>
        {values.tags.length > 0 && (
          <ul data-testid="youtube-tag-list" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {values.tags.map((tag) => (
              <li
                key={tag}
                className="glass-sub flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-[var(--cl-ink)]"
              >
                {tag}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t('youtube.publish.removeTag', { tag })}
                  onClick={() => onChange({ tags: removeTag(values.tags, tag) })}
                  className="focus-cl rounded text-[var(--cl-ink-3)] hover:text-[var(--cl-ink)]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id="youtube-tags"
          type="text"
          value={tagDraft}
          disabled={disabled}
          placeholder={t('youtube.publish.tagsPlaceholder')}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={commitTagDraft}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}
