import { useState } from 'react';

import { copyToClipboard } from '../api/clipboard';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { ErrorNotice } from './error-notice';

export type StoryboardPromptSheetProps = {
  slug: string;
  dirty: boolean;
};

export function StoryboardPromptSheet({ slug, dirty }: StoryboardPromptSheetProps) {
  const client = useRenderApi();
  const [sheet, setSheet] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

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
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">visual prompts</h2>
      <p className="text-sm text-slate-400">
        Paste this sheet into a free generative tool such as Meta AI or Google Flow, one prompt at a
        time, and save each result named by its number (01.mp4, 03.png). The character sheet comes
        first so a character stays the same across shots. The numbered batch import lands in
        spec-e-burgos-010; for now the numbers are how you keep the files aligned with the scenes.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void copySheet()}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          Copy prompts
        </button>
        <button
          type="button"
          disabled={loadAction.status === 'pending'}
          onClick={() => void load()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
        >
          Show prompts
        </button>
        {copied === true && <span className="text-xs text-emerald-300">Copied to the clipboard.</span>}
        {copied === false && (
          <span className="text-xs text-amber-300">
            This browser refused the clipboard: select the sheet below and copy it by hand.
          </span>
        )}
      </div>

      {dirty && (
        <p className="text-xs text-amber-300">
          The sheet is built from the saved storyboard: save your changes first or you will copy the
          previous prompts.
        </p>
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
