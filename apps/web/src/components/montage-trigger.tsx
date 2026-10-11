import { useCallback, useState } from 'react';

import { floorTextOf, parseFloorDb } from '../api/music-mode';
import { montageBlockers } from '../api/montage-capability';
import { MONTAGE_PRESET_DETAILS, montagePresetDetail } from '../api/montage-presets';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { blockerId } from '../api/blockers';
import type { MusicMode } from '../api/motion-types';
import type { MontageJob, MontagePresetName, ServiceHealth } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { MusicModeFields } from './music-mode-fields';

export const TIMELINE_ALREADY_EXISTS = 'TIMELINE_ALREADY_EXISTS';

export type MontageTriggerProps = {
  slug: string;
  onCreated: (job: MontageJob) => void;
};

function isSeedValid(seed: string): boolean {
  return /^\d+$/.test(seed);
}

export function MontageTrigger({ slug, onCreated }: MontageTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');

  const [preset, setPreset] = useState<MontagePresetName>('software-demo');
  const [seed, setSeed] = useState('0');
  const [musicMode, setMusicMode] = useState<MusicMode>('bed');
  const [floorText, setFloorText] = useState(floorTextOf(undefined));
  const t = useT();

  const floorDb = parseFloorDb(floorText);

  const createAction = useApiAction((overwrite: boolean) =>
    client.createMontageJob(slug, {
      preset,
      seed: Number(seed),
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
  const needsConfirmation = createAction.error?.code === TIMELINE_ALREADY_EXISTS;
  const floorValid = musicMode === 'bed' || floorDb !== null;
  const disabled =
    blockers.length > 0 || !seedValid || !floorValid || createAction.status === 'pending';

  return (
    <div
      data-testid="montage-trigger"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        {t('montage.heading')}
      </h2>
      <p className="text-sm text-slate-400">{t('montage.description')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('montage.presetLabel')}
          <select
            aria-label={t('montage.presetLabel')}
            value={preset}
            onChange={(event) => setPreset(event.target.value as MontagePresetName)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          >
            {MONTAGE_PRESET_DETAILS.map((candidate) => (
              <option key={candidate.name} value={candidate.name}>
                {t(candidate.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('montage.seedLabel')}
          <input
            value={seed}
            inputMode="numeric"
            onChange={(event) => setSeed(event.target.value)}
            className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() => void generate(false)}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {createAction.status === 'pending' ? t('montage.generating') : t('montage.generate')}
        </button>
      </div>

      <MusicModeFields
        mode={musicMode}
        floorText={floorText}
        onModeChange={setMusicMode}
        onFloorTextChange={setFloorText}
      />

      <p data-testid="montage-preset-description" className="text-xs text-slate-400">
        <span className="font-mono text-slate-500">{preset}</span> ·{' '}
        {t(montagePresetDetail(preset).descriptionKey)}
      </p>

      {!seedValid && (
        <p className="font-mono text-xs text-amber-300">{t('montage.seedInvalid')}</p>
      )}

      {blockers.length > 0 && (
        <ul data-testid="montage-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label={t('montage.overwriteTitle')}
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="text-sm text-amber-100">{t('montage.overwriteWarning')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={createAction.status === 'pending'}
              className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              {t('montage.overwriteConfirm')}
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300"
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
