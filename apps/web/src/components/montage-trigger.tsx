import { useCallback, useState } from 'react';

import { montageBlockers } from '../api/montage-capability';
import { useRenderApi } from '../api/render-api-context';
import { MONTAGE_PRESETS } from '../api/render-api-types';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { MontageJob, MontagePresetName, ServiceHealth } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';

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

  const createAction = useApiAction((overwrite: boolean) =>
    client.createMontageJob(slug, { preset, seed: Number(seed), overwrite }),
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
  const disabled = blockers.length > 0 || !seedValid || createAction.status === 'pending';

  return (
    <div
      data-testid="montage-trigger"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">montage</h2>
      <p className="text-sm text-slate-400">
        Ingest the raw material and build the timeline with the auto-montage engine, without leaving
        the studio.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Montage preset
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as MontagePresetName)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          >
            {MONTAGE_PRESETS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Seed
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
          {createAction.status === 'pending' ? 'Starting montage…' : 'Generate montage'}
        </button>
      </div>

      {!seedValid && (
        <p className="font-mono text-xs text-amber-300">
          The seed must be a non-negative integer.
        </p>
      )}

      {blockers.length > 0 && (
        <ul data-testid="montage-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label="Overwrite the existing timeline"
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="text-sm text-amber-100">
            This project already has a timeline. Regenerating it overwrites the edited timeline and
            every change saved from the studio is lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={createAction.status === 'pending'}
              className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              Overwrite and regenerate
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              Keep the current timeline
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
