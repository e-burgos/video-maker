import { useCallback, useEffect, useRef, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { storyboardBlockers, storyboardFailureKey } from '../api/storyboard-capability';
import { blockerId } from '../api/blockers';
import { useT } from '../i18n/language-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { ServiceHealth, StoryboardJob } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { useToolbarAction } from './shell/use-toolbar-action';
import {
  DANGER_BUTTON_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
  TEXTAREA_CLASS,
} from './ui/cl-controls';

export const STORYBOARD_ALREADY_EXISTS = 'STORYBOARD_ALREADY_EXISTS';

export type StoryboardInputMode = 'brief' | 'script';

export type StoryboardTriggerProps = {
  slug: string;
  onCreated: (job: StoryboardJob) => void;
  hasStoryboard?: boolean;
};

export function StoryboardTrigger({ slug, onCreated, hasStoryboard = false }: StoryboardTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');

  const [mode, setMode] = useState<StoryboardInputMode>('brief');
  const [text, setText] = useState('');
  const [forcedOpen, setForcedOpen] = useState<boolean | null>(null);
  const [focusRequests, setFocusRequests] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const t = useT();

  useEffect(() => {
    if (focusRequests > 0) {
      textarea.current?.focus();
    }
  }, [focusRequests]);

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
  const pending = createAction.status === 'pending';
  const needsConfirmation = createAction.error?.code === STORYBOARD_ALREADY_EXISTS;
  const explanationKey =
    createAction.error === null ? null : storyboardFailureKey(createAction.error.code);
  const open = forcedOpen ?? !hasStoryboard;

  function proposeFromToolbar() {
    if (!textFilled) {
      setForcedOpen(true);
      setFocusRequests((requests) => requests + 1);
      return;
    }
    void propose(false);
  }

  useToolbarAction({
    label: pending ? t('storyboard.proposing') : t('storyboard.propose'),
    onClick: proposeFromToolbar,
    disabled: blockers.length > 0,
    loading: pending,
  });

  return (
    <section data-testid="storyboard-trigger" className="glass flex flex-col gap-3 rounded-[20px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">{t('storyboard.heading')}</h2>
        {hasStoryboard && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="storyboard-trigger-body"
            onClick={() => setForcedOpen(!open)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('storyboard.triggerToggle')}
          </button>
        )}
      </div>

      <div id="storyboard-trigger-body" hidden={!open} className="flex flex-col gap-3">
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('storyboard.triggerDescription')}</p>

        <div className="flex flex-wrap items-center gap-4">
          {(['brief', 'script'] as const).map((candidate) => (
            <label key={candidate} className="flex items-center gap-2 text-xs text-[var(--cl-ink)]">
              <input
                type="radio"
                name="storyboard-input-mode"
                value={candidate}
                checked={mode === candidate}
                onChange={() => setMode(candidate)}
                className="accent-[var(--cl-action-fill)]"
              />
              {candidate === 'brief' ? t('storyboard.modeBrief') : t('storyboard.modeScript')}
            </label>
          ))}

          <label className="flex items-center gap-2 text-xs text-[var(--cl-ink-2)]">
            <span>{t('storyboard.uploadScript')}</span>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              aria-label={t('storyboard.uploadScriptLabel')}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) {
                  readScriptFile(file);
                }
              }}
              className="focus-cl max-w-full text-xs text-[var(--cl-ink-2)] file:mr-2 file:h-8 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-[var(--cl-action-fill)] file:px-3 file:text-xs file:font-semibold file:text-white"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--cl-ink-2)]">
          {mode === 'brief' ? t('storyboard.briefLabel') : t('storyboard.scriptLabel')}
          <textarea
            ref={textarea}
            aria-label={mode === 'brief' ? t('storyboard.briefLabel') : t('storyboard.scriptLabel')}
            rows={mode === 'brief' ? 4 : 10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              mode === 'brief'
                ? t('storyboard.briefPlaceholder')
                : t('storyboard.scriptPlaceholder')
            }
            className={TEXTAREA_CLASS}
          />
        </label>

        <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('storyboard.proposeHint')}</p>
      </div>

      {open && !textFilled && (
        <p className="font-data m-0 text-xs text-[var(--tucu-state-orange-ink)]">
          {t('storyboard.needsText')}
        </p>
      )}

      {blockers.length > 0 && (
        <ul
          data-testid="storyboard-blockers"
          className="font-data m-0 list-none flex flex-col gap-0.5 p-0 text-xs text-[var(--tucu-state-orange-ink)]"
        >
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label={t('storyboard.overwriteTitle')}
          className="flex flex-col gap-2 rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
        >
          <p className="m-0 text-sm text-[var(--cl-ink)]">{t('storyboard.overwriteWarning')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void propose(true)}
              disabled={pending}
              className={DANGER_BUTTON_SMALL_CLASS}
            >
              {t('storyboard.overwriteConfirm')}
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className={SECONDARY_BUTTON_SMALL_CLASS}
            >
              {t('storyboard.overwriteKeep')}
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <div className="flex flex-col gap-2">
          <ErrorNotice surface="glass" error={createAction.error} />
          {explanationKey !== null && (
            <p
              data-testid="storyboard-failure-explanation"
              className="m-0 text-sm text-[var(--tucu-state-orange-ink)]"
            >
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
