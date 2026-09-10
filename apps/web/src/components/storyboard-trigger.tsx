import { useCallback, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { storyboardBlockers, storyboardFailureExplanation } from '../api/storyboard-capability';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { ServiceHealth, StoryboardJob } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';

export const STORYBOARD_ALREADY_EXISTS = 'STORYBOARD_ALREADY_EXISTS';

export type StoryboardInputMode = 'brief' | 'script';

export type StoryboardTriggerProps = {
  slug: string;
  onCreated: (job: StoryboardJob) => void;
};

export function StoryboardTrigger({ slug, onCreated }: StoryboardTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');

  const [mode, setMode] = useState<StoryboardInputMode>('brief');
  const [text, setText] = useState('');

  const createAction = useApiAction((overwrite: boolean) =>
    client.createStoryboardJob(
      slug,
      mode === 'brief' ? { brief: text, overwrite } : { scriptText: text, overwrite },
    ),
  );

  async function propose(overwrite: boolean) {
    const job = await createAction.run(overwrite);
    if (job !== null) {
      onCreated(job);
    }
  }

  function readScriptFile(file: File) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setMode('script');
      setText(typeof reader.result === 'string' ? reader.result : '');
    });
    reader.readAsText(file);
  }

  const blockers = storyboardBlockers(health.data);
  const textFilled = text.trim().length > 0;
  const needsConfirmation = createAction.error?.code === STORYBOARD_ALREADY_EXISTS;
  const explanation =
    createAction.error === null ? null : storyboardFailureExplanation(createAction.error.code);
  const disabled = blockers.length > 0 || !textFilled || createAction.status === 'pending';

  return (
    <div
      data-testid="storyboard-trigger"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">storyboard</h2>
      <p className="text-sm text-slate-400">
        Start from an idea and let the local AI agent write the script, or paste a script you
        already wrote and let it split into scenes. No API key: the agent runs on this machine.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        {(['brief', 'script'] as const).map((candidate) => (
          <label key={candidate} className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="radio"
              name="storyboard-input-mode"
              value={candidate}
              checked={mode === candidate}
              onChange={() => setMode(candidate)}
            />
            {candidate === 'brief' ? 'Describe an idea' : 'Paste a script'}
          </label>
        ))}

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <span>or upload a script file</span>
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            aria-label="Upload a script file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                readScriptFile(file);
              }
            }}
            className="text-xs text-slate-400 file:mr-2 file:rounded-md file:border file:border-slate-700 file:bg-slate-900 file:px-2 file:py-1 file:text-xs file:text-slate-200"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {mode === 'brief' ? 'Brief' : 'Script'}
        <textarea
          aria-label={mode === 'brief' ? 'Brief' : 'Script'}
          rows={mode === 'brief' ? 4 : 10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            mode === 'brief'
              ? 'A 45 second vertical video about three terminal tricks, energetic, in Rioplatense Spanish.'
              : 'Paste the script exactly as you want it narrated.'
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void propose(false)}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {createAction.status === 'pending' ? 'Asking the agent…' : 'Propose storyboard'}
        </button>
        <span className="text-xs text-slate-500">
          The agent takes more than a minute to answer: the propose stage is a real model call.
        </span>
      </div>

      {!textFilled && (
        <p className="font-mono text-xs text-amber-300">
          Write a brief or paste a script before proposing.
        </p>
      )}

      {blockers.length > 0 && (
        <ul data-testid="storyboard-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label="Overwrite the existing storyboard"
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="text-sm text-amber-100">
            This project already has a storyboard. Proposing a new one replaces it, and every scene
            you edited by hand is lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void propose(true)}
              disabled={createAction.status === 'pending'}
              className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              Overwrite and propose again
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              Keep the current storyboard
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <div className="space-y-2">
          <ErrorNotice error={createAction.error} />
          {explanation !== null && (
            <p data-testid="storyboard-failure-explanation" className="text-sm text-amber-100">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
