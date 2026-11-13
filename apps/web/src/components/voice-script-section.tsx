import { StateBadge } from '@e-burgos/tucu-ui';
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
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
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
      <div className="flex flex-col gap-2 border-t border-[var(--tucu-glass-sub-line)] pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasDirection(direction) && (
            <StateBadge tone="teal" dot size="sm" data-testid="voice-direction-badge">
              {t('voiceDirection.badge')}
            </StateBadge>
          )}
          {unapplied && (
            <span data-testid="voice-direction-unapplied" className="text-xs text-[var(--tucu-state-orange-ink)]">
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
    <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section
        data-testid="voice-direction-bar"
        className="glass min-w-0 flex flex-col gap-3 rounded-[20px] p-4"
      >
        <h2 className="m-0 text-base font-bold text-[var(--cl-ink)]">
          {t('voiceDirection.heading')}{' '}
          <span data-testid="voice-direction-count" className="font-data text-xs font-normal text-[var(--cl-ink-3)]">
            ({t('voiceDirection.directedCount', { count: directedLineCount(current) })})
          </span>
        </h2>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('voiceDirection.description')}</p>

        {document.status === 'loading' && (
          <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('voiceDirection.loading')}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!ready || !dirty || busy}
            onClick={() => void persist()}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {saveAction.status === 'pending' ? t('voiceDirection.saving') : t('voiceDirection.save')}
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void regenerate()}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {regenerateAction.status === 'pending'
              ? t('voiceDirection.regenerating')
              : t('voiceDirection.regenerate')}
          </button>
          {dirty && (
            <StateBadge tone="orange" dot size="sm">
              {t('voiceDirection.dirty')}
            </StateBadge>
          )}
          {saved && !dirty && (
            <span role="status" className="text-xs text-[var(--tucu-state-green-ink)]">
              {t('voiceDirection.saved')}
            </span>
          )}
        </div>

        {document.status === 'error' && document.error !== null && (
          <ErrorNotice surface="glass" error={document.error} onRetry={document.reload} />
        )}
        {saveAction.error !== null && <ErrorNotice surface="glass" error={saveAction.error} />}
        {regenerateAction.error !== null && <ErrorNotice surface="glass" error={regenerateAction.error} />}
      </section>

      <VoiceScriptPanel
        slug={slug}
        manifest={manifest}
        {...(ready ? { renderLineExtra } : {})}
      />
    </div>
  );
}
