import { useCallback, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { voiceBlockers, voiceFailureExplanation } from '../api/voice-capability';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { ServiceHealth, VoiceJob, VoiceListing } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';

export const VOICE_ALREADY_EXISTS = 'VOICE_ALREADY_EXISTS';

export type VoiceTriggerProps = {
  slug: string;
  onCreated: (job: VoiceJob) => void;
};

export function defaultVoiceId(listing: VoiceListing | null): string | null {
  if (listing === null || listing.voices.length === 0) {
    return null;
  }
  return (listing.voices.find((voice) => voice.isDefault) ?? listing.voices[0])?.id ?? null;
}

export function VoiceTrigger({ slug, onCreated }: VoiceTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const loadVoices = useCallback(() => client.listVoices(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');
  const voices = useAsyncResource<VoiceListing>(loadVoices, 'voices');

  const [picked, setPicked] = useState<string | null>(null);

  const createAction = useApiAction((overwrite: boolean, voiceId: string | null) =>
    client.createVoiceJob(slug, { voiceId, sceneIds: null, overwrite }),
  );

  const selectedVoiceId = picked ?? defaultVoiceId(voices.data);

  async function generate(overwrite: boolean) {
    const job = await createAction.run(overwrite, selectedVoiceId);
    if (job !== null) {
      onCreated(job);
    }
  }

  const blockers = voiceBlockers(health.data);
  const catalogueEmpty = voices.data !== null && voices.data.voices.length === 0;
  const needsConfirmation = createAction.error?.code === VOICE_ALREADY_EXISTS;
  const explanation =
    createAction.error === null ? null : voiceFailureExplanation(createAction.error.code);
  const disabled =
    blockers.length > 0 ||
    selectedVoiceId === null ||
    createAction.status === 'pending' ||
    voices.status === 'loading';

  return (
    <div
      data-testid="voice-trigger"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">voice-over</h2>
      <p className="text-sm text-slate-400">
        Piper reads the narration of every scene on this machine and Whisper aligns it word by word,
        so each scene gets its own track and its real duration. No API key, no upload.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="voice-model" className="text-xs text-slate-400">
          Voice
        </label>
        <select
          id="voice-model"
          aria-label="Voice model"
          value={selectedVoiceId ?? ''}
          disabled={voices.data === null || catalogueEmpty}
          onChange={(event) => setPicked(event.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100 disabled:opacity-40"
        >
          {voices.data?.voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.isDefault ? `${voice.id} (default)` : voice.id}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={disabled}
          onClick={() => void generate(false)}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {createAction.status === 'pending' ? 'Sending…' : 'Generate voice-over'}
        </button>
      </div>

      {voices.status === 'loading' && (
        <p className="text-xs text-slate-500">Reading the installed voices…</p>
      )}

      {catalogueEmpty && (
        <p data-testid="voice-catalogue-empty" className="font-mono text-xs text-amber-300">
          Piper answers, but there is no .onnx voice next to the configured model.
        </p>
      )}

      {voices.status === 'error' && voices.error !== null && (
        <div data-testid="voice-catalogue-error" className="space-y-2">
          <ErrorNotice error={voices.error} onRetry={voices.reload} />
          {voiceFailureExplanation(voices.error.code) !== null && (
            <p className="text-sm text-amber-100">{voiceFailureExplanation(voices.error.code)}</p>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <ul data-testid="voice-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label="Overwrite the existing voice-over"
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="text-sm text-amber-100">
            Some scenes already have a track. Generating again replaces the audio of every scene,
            including the takes you recorded yourself.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={createAction.status === 'pending'}
              className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              Overwrite and generate again
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              Keep the current voice-over
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <div className="space-y-2">
          <ErrorNotice error={createAction.error} />
          {explanation !== null && (
            <p data-testid="voice-failure-explanation" className="text-sm text-amber-100">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
