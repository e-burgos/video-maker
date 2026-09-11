import type { StoryboardDocument, StoryboardFormat } from '@video-maker/timeline-core';

import {
  STORYBOARD_FORMATS,
  formatTags,
  setStoryboardHeader,
  setStoryboardMusicTags,
} from '../api/storyboard-edit/storyboard-document';
import { useT } from '../i18n/language-context';

export type StoryboardHeaderEditorProps = {
  storyboard: StoryboardDocument;
  onChange: (next: StoryboardDocument) => void;
};

export function StoryboardHeaderEditor({ storyboard, onChange }: StoryboardHeaderEditorProps) {
  const t = useT();

  return (
    <div
      data-testid="storyboard-header-editor"
      className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-xs text-slate-400 sm:col-span-2">
        {t('storyboardHeader.title')}
        <input
          value={storyboard.title}
          onChange={(event) => onChange(setStoryboardHeader(storyboard, 'title', event.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardHeader.language')}
        <input
          value={storyboard.language}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'language', event.target.value))
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardHeader.format')}
        <select
          aria-label={t('storyboardHeader.format')}
          value={storyboard.format}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'format', event.target.value as StoryboardFormat))
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
        >
          {STORYBOARD_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardHeader.captionStyle')}
        <input
          value={storyboard.captionsStyle}
          onChange={(event) =>
            onChange(setStoryboardHeader(storyboard, 'captionsStyle', event.target.value))
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardHeader.musicTags')}
        <input
          value={formatTags(storyboard.musicTags)}
          onChange={(event) => onChange(setStoryboardMusicTags(storyboard, event.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
        />
      </label>

      <p className="text-xs text-slate-500 sm:col-span-2">{t('storyboardHeader.note')}</p>
    </div>
  );
}
