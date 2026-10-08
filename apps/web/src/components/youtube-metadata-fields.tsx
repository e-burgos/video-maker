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
      className="font-mono text-xs text-slate-500 data-[over=true]:text-rose-300"
    >
      {count}/{max}
    </span>
  );
}

const FIELD_CLASS =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50';

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
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-title" className="text-sm text-slate-400">
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
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-description" className="text-sm text-slate-400">
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
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="youtube-tags" className="text-sm text-slate-400">
            {t('youtube.publish.tags')}
          </label>
          <Counter
            testId="youtube-tags-counter"
            count={tagsCharCount(values.tags)}
            max={YOUTUBE_TAGS_MAX_CHARS}
          />
        </div>
        {values.tags.length > 0 && (
          <ul data-testid="youtube-tag-list" className="flex flex-wrap gap-1.5">
            {values.tags.map((tag) => (
              <li
                key={tag}
                className="flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-200"
              >
                {tag}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t('youtube.publish.removeTag', { tag })}
                  onClick={() => onChange({ tags: removeTag(values.tags, tag) })}
                  className="text-slate-500 hover:text-slate-200"
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
          className={FIELD_CLASS}
        />
      </div>
    </div>
  );
}
