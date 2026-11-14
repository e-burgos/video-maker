import { useCallback, useState } from 'react';

import { floorTextOf, parseFloorDb } from '../api/music-mode';
import { montageBlockers } from '../api/montage-capability';
import {
  MONTAGE_PRESET_DETAILS,
  montagePresetDetail,
} from '../api/montage-presets';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { blockerId } from '../api/blockers';
import type { MusicMode } from '../api/motion-types';
import type {
  MontageJob,
  MontagePresetName,
  ServiceHealth,
} from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { MusicModeFields } from './music-mode-fields';
import {
  DANGER_BUTTON_SMALL_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
} from './ui/cl-controls';

export const TIMELINE_ALREADY_EXISTS = 'TIMELINE_ALREADY_EXISTS';

export type MontageTriggerProps = {
  slug: string;
  onCreated: (job: MontageJob) => void;
};

function isSeedValid(seed: string): boolean {
  return seed.trim() === '' || /^\d+$/.test(seed.trim());
}

function chosenSeed(seed: string): { seed: number } | Record<string, never> {
  return seed.trim() === '' ? {} : { seed: Number(seed.trim()) };
}

export function MontageTrigger({ slug, onCreated }: MontageTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');

  const [preset, setPreset] = useState<MontagePresetName>('software-demo');
  const [seed, setSeed] = useState('');
  const [musicMode, setMusicMode] = useState<MusicMode>('bed');
  const [floorText, setFloorText] = useState(floorTextOf(undefined));
  const t = useT();

  const floorDb = parseFloorDb(floorText);

  const createAction = useApiAction((overwrite: boolean) =>
    client.createMontageJob(slug, {
      preset,
      ...chosenSeed(seed),
      overwrite,
      ...(musicMode === 'segments' && floorDb !== null
        ? { musicMode: 'segments' as const, musicFloorDb: floorDb }
        : {}),
    }),
  );

  async function generate(overwrite: boolean) {
    const job = await createAction.run(overwrite);
    if (job !== null) {
      onCreated(job);
    }
  }

  const blockers = montageBlockers(health.data);
  const seedValid = isSeedValid(seed);
  const needsConfirmation =
    createAction.error?.code === TIMELINE_ALREADY_EXISTS;
  const floorValid = musicMode === 'bed' || floorDb !== null;
  const disabled =
    blockers.length > 0 ||
    !seedValid ||
    !floorValid ||
    createAction.status === 'pending';

  return (
    <div
      data-testid="montage-trigger"
      className="glass space-y-3 rounded-[20px] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">
          {t('montage.heading')}
        </h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void generate(false)}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {createAction.status === 'pending'
            ? t('montage.generating')
            : t('montage.generate')}
        </button>
      </div>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">
        {t('montage.description')}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
          {t('montage.presetLabel')}
          <select
            aria-label={t('montage.presetLabel')}
            value={preset}
            onChange={(event) =>
              setPreset(event.target.value as MontagePresetName)
            }
            className={FIELD_SMALL_CLASS}
          >
            {MONTAGE_PRESET_DETAILS.map((candidate) => (
              <option key={candidate.name} value={candidate.name}>
                {t(candidate.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
          {t('montage.seedLabel')}
          <input
            value={seed}
            inputMode="numeric"
            placeholder={t('montage.seedAuto')}
            title={t('montage.seedHint')}
            onChange={(event) => setSeed(event.target.value)}
            className={`${FIELD_SMALL_CLASS} font-data w-24`}
          />
        </label>
      </div>

      <MusicModeFields
        mode={musicMode}
        floorText={floorText}
        onModeChange={setMusicMode}
        onFloorTextChange={setFloorText}
      />

      <p
        data-testid="montage-preset-description"
        className="m-0 text-xs text-[var(--cl-ink-2)]"
      >
        <span className="font-data text-[var(--cl-ink-3)]">{preset}</span> ·{' '}
        {t(montagePresetDetail(preset).descriptionKey)}
      </p>

      {!seedValid && (
        <p className="font-data m-0 text-xs text-[var(--tucu-state-orange-ink)]">
          {t('montage.seedInvalid')}
        </p>
      )}

      {blockers.length > 0 && (
        <ul
          data-testid="montage-blockers"
          className="font-data m-0 space-y-0.5 pl-0 text-xs text-[var(--tucu-state-orange-ink)]"
        >
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)} className="list-none">
              {t(blocker.key, blocker.params)}
            </li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label={t('montage.overwriteTitle')}
          className="space-y-2 rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
        >
          <p className="m-0 text-sm text-[var(--cl-ink)]">
            {t('montage.overwriteWarning')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={createAction.status === 'pending'}
              className={DANGER_BUTTON_SMALL_CLASS}
            >
              {t('montage.overwriteConfirm')}
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className={SECONDARY_BUTTON_SMALL_CLASS}
            >
              {t('montage.overwriteKeep')}
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <ErrorNotice error={createAction.error} />
      )}
    </div>
  );
}
