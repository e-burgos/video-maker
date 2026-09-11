import { useState } from 'react';

import { copyToClipboard } from '../api/clipboard';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

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
    <div
      data-testid="storyboard-prompt-sheet"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        {t('storyboardPrompts.heading')}
      </h2>
      <p className="text-sm text-slate-400">{t('storyboardPrompts.description')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void copySheet()}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {t('storyboardPrompts.copy')}
        </button>
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void load()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
        >
          {t('storyboardPrompts.show')}
        </button>
        {copied === true && (
          <span className="text-xs text-emerald-300">{t('storyboardPrompts.copied')}</span>
        )}
        {copied === false && (
          <span className="text-xs text-amber-300">{t('storyboardPrompts.clipboardRefused')}</span>
        )}
      </div>

      {dirty && (
        <p className="text-xs text-amber-300">{t('storyboardPrompts.dirty')}</p>
      )}

      {loadAction.error !== null && <ErrorNotice error={loadAction.error} />}

      {sheet !== null && (
        <pre
          data-testid="storyboard-prompt-text"
          className="max-h-96 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs whitespace-pre-wrap text-slate-300"
        >
          {sheet}
        </pre>
      )}
    </div>
  );
}
