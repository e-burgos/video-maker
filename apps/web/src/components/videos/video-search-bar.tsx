import { LucideIcons } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { FIELD_CLASS, SECONDARY_BUTTON_CLASS } from '../ui/cl-controls';

export type VideoSearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onNewFolder: () => void;
};

export function VideoSearchBar({ query, onQueryChange, onNewFolder }: VideoSearchBarProps) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 basis-60">
        <span className="sr-only">{t('projects.search.label')}</span>
        <LucideIcons.Search
          aria-hidden
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cl-ink-3)]"
        />
        <input
          type="search"
          data-testid="video-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('projects.search.placeholder')}
          className={`${FIELD_CLASS} w-full pl-9`}
        />
      </label>
      <button type="button" data-testid="new-folder-open" onClick={onNewFolder} className={SECONDARY_BUTTON_CLASS}>
        {t('projects.newFolderCta')}
      </button>
    </div>
  );
}
