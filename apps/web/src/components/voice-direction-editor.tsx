import { MAX_VOICE_PAUSE_AFTER_MS, VOICE_ENERGIES, VOICE_PACES } from '@video-maker/timeline-core';
import type { VoiceDirection, VoiceEnergy, VoicePace } from '@video-maker/timeline-core';

import {
  MAX_EMPHASIS_WORDS,
  PAUSE_STEP_MS,
  emphasisIsFull,
  hasDirection,
  isEmphasized,
  toggleEmphasis,
  withEnergy,
  withPace,
  withPauseAfterMs,
  wordsOfLine,
} from '../api/voice-direction';
import { ENERGY_KEYS, PACE_KEYS } from '../api/voice-direction-i18n';
import { useT } from '../i18n/language-context';

export type VoiceDirectionEditorProps = {
  target: string;
  text: string;
  direction: VoiceDirection | undefined;
  onChange: (next: VoiceDirection | undefined) => void;
};

const FIELD_CLASS =
  'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200';

export function VoiceDirectionEditor({ target, text, direction, onChange }: VoiceDirectionEditorProps) {
  const t = useT();
  const words = wordsOfLine(text);
  const full = emphasisIsFull(direction);

  return (
    <div data-testid="voice-direction-editor" className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('voiceDirection.pace', { target })}
          <select
            aria-label={t('voiceDirection.pace', { target })}
            value={direction?.pace ?? 'normal'}
            onChange={(event) => onChange(withPace(direction, event.target.value as VoicePace))}
            className={FIELD_CLASS}
          >
            {VOICE_PACES.map((pace) => (
              <option key={pace} value={pace}>
                {t(PACE_KEYS[pace])}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('voiceDirection.energy', { target })}
          <select
            aria-label={t('voiceDirection.energy', { target })}
            value={direction?.energy ?? 'neutral'}
            onChange={(event) => onChange(withEnergy(direction, event.target.value as VoiceEnergy))}
            className={FIELD_CLASS}
          >
            {VOICE_ENERGIES.map((energy) => (
              <option key={energy} value={energy}>
                {t(ENERGY_KEYS[energy])}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('voiceDirection.pause', { target })}
          <input
            type="number"
            aria-label={t('voiceDirection.pause', { target })}
            min={0}
            max={MAX_VOICE_PAUSE_AFTER_MS}
            step={PAUSE_STEP_MS}
            value={direction?.pauseAfterMs ?? 0}
            onChange={(event) => onChange(withPauseAfterMs(direction, Number(event.target.value)))}
            className={`${FIELD_CLASS} w-24 font-mono`}
          />
        </label>

        {hasDirection(direction) && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
          >
            {t('voiceDirection.clear', { target })}
          </button>
        )}
      </div>

      <div role="group" aria-label={t('voiceDirection.emphasis', { target })} className="space-y-1">
        <p className="text-xs text-slate-400">{t('voiceDirection.emphasis', { target })}</p>
        {words.length === 0 ? (
          <p className="text-xs text-slate-500">{t('voiceDirection.emphasisNone')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {words.map((word) => {
              const pressed = isEmphasized(direction, word);
              return (
                <li key={word}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    disabled={full && !pressed}
                    onClick={() => onChange(toggleEmphasis(direction, word))}
                    className={`rounded-full border px-2 py-0.5 text-xs disabled:opacity-40 ${
                      pressed
                        ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {word}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {full && (
          <p className="text-xs text-amber-300">
            {t('voiceDirection.emphasisFull', { max: MAX_EMPHASIS_WORDS })}
          </p>
        )}
      </div>
    </div>
  );
}
