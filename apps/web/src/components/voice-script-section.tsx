import { useCallback, useState } from 'react';
import type {
  VoiceDirection,
  VoiceScriptDirections,
  VoiceScriptLine,
  VoiceScriptManifest,
} from '@video-maker/timeline-core';

import { PRODUCER_SCRIPT_PATH } from '../api/generated-files';
import { useRenderApi } from '../api/render-api-context';
import type { VoiceDirectionDocument } from '../api/render-api-client';
import type { VoiceJob } from '../api/render-api-types';
import {
  directedLineCount,
  directionOfLine,
  emphasisInLine,
  hasDirection,
  sameDirection,
  sameDirections,
  setLineDirection,
} from '../api/voice-direction';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { VoiceDirectionEditor } from './voice-direction-editor';
import { VoiceScriptPanel } from './voice-script-panel';

export type VoiceScriptSectionProps = {
  slug: string;
  manifest: VoiceScriptManifest;
  onJobCreated: (job: VoiceJob) => void;
};

const NO_DIRECTIONS: VoiceScriptDirections = {};

export function VoiceScriptSection({ slug, manifest, onJobCreated }: VoiceScriptSectionProps) {
  const client = useRenderApi();
  const t = useT();

  const document = useAsyncResource<VoiceDirectionDocument>(
    useCallback(() => client.getVoiceDirection(slug), [client, slug]),
    `voice-direction:${slug}`,
  );
  const [draft, setDraft] = useState<VoiceScriptDirections | null>(null);
  const [saved, setSaved] = useState(false);

  const stored = document.data?.directions ?? NO_DIRECTIONS;
  const current = draft ?? stored;
  const dirty = draft !== null && !sameDirections(draft, stored);

  const saveAction = useApiAction((directions: VoiceScriptDirections) =>
    client.putVoiceDirection(slug, directions),
  );
  const regenerateAction = useApiAction(() =>
    client.createVoiceJob(slug, {
      voiceId: manifest.voiceId,
      sceneIds: null,
      overwrite: true,
      scriptPath: PRODUCER_SCRIPT_PATH,
    }),
  );

  async function persist(): Promise<boolean> {
    setSaved(false);
    const result = await saveAction.run(current);
    if (result === null) {
      return false;
    }
    setDraft(null);
    setSaved(true);
    document.reload();
    return true;
  }

  async function regenerate() {
    if (dirty && !(await persist())) {
      return;
    }
    const job = await regenerateAction.run();
    if (job !== null) {
      onJobCreated(job);
    }
  }

  function edit(line: VoiceScriptLine, next: VoiceDirection | undefined) {
    setSaved(false);
    setDraft(setLineDirection(current, line.index, next));
  }

  function renderLineExtra(line: VoiceScriptLine) {
    const direction = directionOfLine(current, line.index);
    const unapplied =
      !dirty && !sameDirection(directionOfLine(stored, line.index), emphasisInLine(line.direction, line.text));

    return (
      <div className="space-y-2 border-t border-slate-800 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasDirection(direction) && (
            <span
              data-testid="voice-direction-badge"
              className="rounded-full border border-sky-400/60 px-2 py-0.5 text-xs text-sky-100"
            >
              {t('voiceDirection.badge')}
            </span>
          )}
          {unapplied && (
            <span data-testid="voice-direction-unapplied" className="text-xs text-amber-300">
              {t('voiceDirection.unapplied')}
            </span>
          )}
        </div>
        <VoiceDirectionEditor
          target={t('voiceDirection.lineTarget', { index: line.index })}
          text={line.text}
          direction={direction}
          onChange={(next) => edit(line, next)}
        />
      </div>
    );
  }

  const busy = saveAction.status === 'pending' || regenerateAction.status === 'pending';
  const ready = document.status === 'ready' && document.data !== null;

  return (
    <div className="space-y-4">
      <div
        data-testid="voice-direction-bar"
        className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
      >
        <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
          {t('voiceDirection.heading')}{' '}
          <span data-testid="voice-direction-count" className="text-slate-600">
            ({t('voiceDirection.directedCount', { count: directedLineCount(current) })})
          </span>
        </h2>
        <p className="text-sm text-slate-400">{t('voiceDirection.description')}</p>

        {document.status === 'loading' && (
          <p className="text-xs text-slate-500">{t('voiceDirection.loading')}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || !dirty || busy}
            onClick={() => void persist()}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-40"
          >
            {saveAction.status === 'pending' ? t('voiceDirection.saving') : t('voiceDirection.save')}
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void regenerate()}
            className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
          >
            {regenerateAction.status === 'pending'
              ? t('voiceDirection.regenerating')
              : t('voiceDirection.regenerate')}
          </button>
          {dirty && <span className="text-xs text-amber-300">{t('voiceDirection.dirty')}</span>}
          {saved && !dirty && (
            <span role="status" className="text-xs text-emerald-300">
              {t('voiceDirection.saved')}
            </span>
          )}
        </div>

        {document.status === 'error' && document.error !== null && (
          <ErrorNotice error={document.error} onRetry={document.reload} />
        )}
        {saveAction.error !== null && <ErrorNotice error={saveAction.error} />}
        {regenerateAction.error !== null && <ErrorNotice error={regenerateAction.error} />}
      </div>

      <VoiceScriptPanel
        slug={slug}
        manifest={manifest}
        {...(ready ? { renderLineExtra } : {})}
      />
    </div>
  );
}
