import { SegmentedControl, segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useT } from '../../../i18n/language-context';
import { ErrorNotice } from '../../error-notice';
import { Modal } from '../../modal';
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '../../ui/cl-controls';
import { EmptyState, LoadingState } from '../../ui/status-states';
import { FreeMediaResultCard } from './free-media-result-card';
import {
  DEFAULT_RESULT_CAP,
  FREE_MEDIA_TABS_ID_BASE,
  FREE_MEDIA_TAB_LABEL,
  RESULT_CAP_OPTIONS,
} from './free-media-model';
import type { FreeMediaTab } from './free-media-model';
import { useFreeMediaSession } from './use-free-media-session';

export type FreeMediaPanelProps = {
  slug: string;
  tabs: readonly FreeMediaTab[];
  onImported: () => void;
  onClose: () => void;
};

export function FreeMediaPanel({ slug, tabs, onImported, onClose }: FreeMediaPanelProps) {
  const t = useT();
  const [tab, setTab] = useState<FreeMediaTab>(tabs[0] ?? 'image');
  const [text, setText] = useState('');
  const [cap, setCap] = useState<number>(DEFAULT_RESULT_CAP);
  const session = useFreeMediaSession(slug, tab, onImported);
  const isMusic = tab === 'music';
  const searchable = text.trim().length > 0 && session.phase !== 'loading';

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (searchable) {
      session.search(text.trim(), cap);
    }
  }

  return (
    <Modal
      title={t('library.freeMedia.title')}
      testId="free-media-panel"
      wide
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>
          {t('library.freeMedia.close')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[12px] p-[3px]">
          <SegmentedControl
            size="sm"
            semantics="tabs"
            idBase={FREE_MEDIA_TABS_ID_BASE}
            aria-label={t('library.freeMedia.tabs')}
            options={tabs.map((value) => ({
              value,
              label: t(FREE_MEDIA_TAB_LABEL[value]),
              'data-testid': `free-media-tab-${value}`,
            }))}
            value={tab}
            onChange={(next) => setTab(next as FreeMediaTab)}
          />
        </div>

        <div
          role="tabpanel"
          id={segmentedControlPanelId(FREE_MEDIA_TABS_ID_BASE, tab)}
          aria-labelledby={segmentedControlTabId(FREE_MEDIA_TABS_ID_BASE, tab)}
          data-testid="free-media-tabpanel"
          className="flex flex-col gap-3"
        >
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>
                {isMusic ? t('library.freeMedia.mood') : t('library.freeMedia.query')}
              </span>
              <input
                type="search"
                data-testid="free-media-query"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={isMusic ? t('library.freeMedia.moodPlaceholder') : t('library.freeMedia.queryPlaceholder')}
                className={FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>{t('library.freeMedia.cap')}</span>
              <select
                data-testid="free-media-cap"
                value={cap}
                onChange={(event) => setCap(Number(event.target.value))}
                className={FIELD_CLASS}
              >
                {RESULT_CAP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" data-testid="free-media-search" disabled={!searchable} className={PRIMARY_BUTTON_CLASS}>
              {t('library.freeMedia.search')}
            </button>
          </form>

          {session.phase === 'idle' && <EmptyState message={t('library.freeMedia.hint')} />}
          {session.phase === 'loading' && <LoadingState message={t('library.freeMedia.loading')} />}
          {session.phase === 'error' && session.searchError !== null && (
            <ErrorNotice error={session.searchError} onRetry={() => session.search(text.trim(), cap)} />
          )}
          {session.phase === 'ready' && session.results.length === 0 && (
            <div data-testid="free-media-empty">
              <EmptyState title={t('library.freeMedia.emptyTitle')} message={t('library.freeMedia.empty')} />
            </div>
          )}
          {session.importError !== null && <ErrorNotice error={session.importError} />}
          {session.phase === 'ready' && session.results.length > 0 && (
            <ul
              aria-label={t('library.freeMedia.results')}
              data-testid="free-media-results"
              className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[560px]:grid-cols-2"
            >
              {session.results.map((result) => (
                <FreeMediaResultCard
                  key={result.resultId}
                  result={result}
                  phase={session.imports[result.resultId]}
                  onImport={session.importResult}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
