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
import { FIELD_LABEL_CLASS, FIELD_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type VoiceDirectionEditorProps = {
  target: string;
  text: string;
  direction: VoiceDirection | undefined;
  onChange: (next: VoiceDirection | undefined) => void;
};

const LABEL_CLASS = `flex flex-col gap-1 ${FIELD_LABEL_CLASS}`;

export function VoiceDirectionEditor({ target, text, direction, onChange }: VoiceDirectionEditorProps) {
  const t = useT();
  const words = wordsOfLine(text);
  const full = emphasisIsFull(direction);

  return (
    <div data-testid="voice-direction-editor" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL_CLASS}>
          {t('voiceDirection.pace', { target })}
          <select
            aria-label={t('voiceDirection.pace', { target })}
            value={direction?.pace ?? 'normal'}
            onChange={(event) => onChange(withPace(direction, event.target.value as VoicePace))}
            className={FIELD_SMALL_CLASS}
          >
            {VOICE_PACES.map((pace) => (
              <option key={pace} value={pace}>
                {t(PACE_KEYS[pace])}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          {t('voiceDirection.energy', { target })}
          <select
            aria-label={t('voiceDirection.energy', { target })}
            value={direction?.energy ?? 'neutral'}
            onChange={(event) => onChange(withEnergy(direction, event.target.value as VoiceEnergy))}
            className={FIELD_SMALL_CLASS}
          >
            {VOICE_ENERGIES.map((energy) => (
              <option key={energy} value={energy}>
                {t(ENERGY_KEYS[energy])}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          {t('voiceDirection.pause', { target })}
          <input
            type="number"
            aria-label={t('voiceDirection.pause', { target })}
            min={0}
            max={MAX_VOICE_PAUSE_AFTER_MS}
            step={PAUSE_STEP_MS}
            value={direction?.pauseAfterMs ?? 0}
            onChange={(event) => onChange(withPauseAfterMs(direction, Number(event.target.value)))}
            className={`${FIELD_SMALL_CLASS} font-data w-24`}
          />
        </label>

        {hasDirection(direction) && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('voiceDirection.clear', { target })}
          </button>
        )}
      </div>

      <div role="group" aria-label={t('voiceDirection.emphasis', { target })} className="flex flex-col gap-1">
        <p className="m-0 text-xs font-medium text-[var(--cl-ink-2)]">{t('voiceDirection.emphasis', { target })}</p>
        {words.length === 0 ? (
          <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('voiceDirection.emphasisNone')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
            {words.map((word) => {
              const pressed = isEmphasized(direction, word);
              return (
                <li key={word}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    disabled={full && !pressed}
                    onClick={() => onChange(toggleEmphasis(direction, word))}
                    className={`focus-cl rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                      pressed
                        ? 'border-[var(--cl-action)] bg-[color-mix(in_srgb,var(--cl-action)_18%,transparent)] text-[var(--cl-action-text)]'
                        : 'glass-sub text-[var(--cl-ink)] hover:border-[var(--cl-ink-3)]'
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
          <p className="m-0 text-xs text-[var(--tucu-state-orange-ink)]">
            {t('voiceDirection.emphasisFull', { max: MAX_EMPHASIS_WORDS })}
          </p>
        )}
      </div>
    </div>
  );
}
