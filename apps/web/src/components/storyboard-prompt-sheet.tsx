import { useState } from 'react';

import { copyToClipboard } from '../api/clipboard';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type StoryboardPromptSheetProps = {
  slug: string;
  dirty: boolean;
};

export function StoryboardPromptSheet({ slug, dirty }: StoryboardPromptSheetProps) {
  const client = useRenderApi();
  const [sheet, setSheet] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const t = useT();

  const loadAction = useApiAction(() => client.getStoryboardPrompts(slug));

  async function load(): Promise<string | null> {
    const text = await loadAction.run();
    if (text !== null) {
      setSheet(text);
    }
    return text;
  }

  async function copySheet() {
    const text = await load();
    setCopied(text === null ? null : await copyToClipboard(text));
  }

  return (
    <section
      data-testid="storyboard-prompt-sheet"
      className="glass flex flex-col gap-3 rounded-[20px] p-4"
    >
      <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">
        {t('storyboardPrompts.heading')}
      </h2>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('storyboardPrompts.description')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void copySheet()}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t('storyboardPrompts.copy')}
        </button>
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void load()}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t('storyboardPrompts.show')}
        </button>
        {copied === true && (
          <span className="text-xs text-[var(--tucu-state-green-ink)]">{t('storyboardPrompts.copied')}</span>
        )}
        {copied === false && (
          <span className="text-xs text-[var(--tucu-state-orange-ink)]">{t('storyboardPrompts.clipboardRefused')}</span>
        )}
      </div>

      {dirty && (
        <p className="m-0 text-xs text-[var(--tucu-state-orange-ink)]">{t('storyboardPrompts.dirty')}</p>
      )}

      {loadAction.error !== null && <ErrorNotice error={loadAction.error} />}

      {sheet !== null && (
        <pre
          data-testid="storyboard-prompt-text"
          className="font-data glass-sub m-0 max-h-96 overflow-auto rounded-[12px] p-3 text-xs whitespace-pre-wrap text-[var(--cl-ink)]"
        >
          {sheet}
        </pre>
      )}
    </section>
  );
}
