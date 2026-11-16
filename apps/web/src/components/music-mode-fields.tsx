import {
  MUSIC_FLOOR_DB_MAX,
  MUSIC_FLOOR_DB_MIN,
  MUSIC_MODES,
} from '../api/motion-types';
import type { MusicMode } from '../api/motion-types';
import { floorDbIssue } from '../api/music-mode';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { FIELD_LABEL_CLASS, FIELD_SMALL_CLASS } from './ui/cl-controls';

const MODE_KEYS: Readonly<Record<MusicMode, TranslationKey>> = {
  bed: 'musicMode.bed',
  segments: 'musicMode.segments',
};

export type MusicModeFieldsProps = {
  mode: MusicMode;
  floorText: string;
  onModeChange: (mode: MusicMode) => void;
  onFloorTextChange: (floorText: string) => void;
};

export function MusicModeFields({
  mode,
  floorText,
  onModeChange,
  onFloorTextChange,
}: MusicModeFieldsProps) {
  const t = useT();
  const invalid = mode === 'segments' && floorDbIssue(floorText);

  return (
    <div data-testid="music-mode-fields" className="space-y-1">
      <div className="flex flex-wrap items-end gap-3">
        <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
          {t('musicMode.label')}
          <select
            aria-label={t('musicMode.label')}
            value={mode}
            onChange={(event) => onModeChange(event.target.value as MusicMode)}
            className={FIELD_SMALL_CLASS}
          >
            {MUSIC_MODES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(MODE_KEYS[candidate])}
              </option>
            ))}
          </select>
        </label>

        {mode === 'segments' && (
          <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
            {t('musicMode.floor')}
            <input
              type="text"
              inputMode="decimal"
              aria-label={t('musicMode.floor')}
              value={floorText}
              onChange={(event) => onFloorTextChange(event.target.value)}
              className={`${FIELD_SMALL_CLASS} font-data w-24`}
            />
          </label>
        )}
      </div>

      <p className="m-0 text-xs text-[var(--cl-ink-2)]">
        {mode === 'segments'
          ? t('musicMode.segmentsHint')
          : t('musicMode.bedHint')}
      </p>

      {invalid && (
        <p role="alert" className="font-data text-xs text-[var(--tucu-state-orange-ink)]">
          {t('musicMode.floorInvalid', {
            min: MUSIC_FLOOR_DB_MIN,
            max: MUSIC_FLOOR_DB_MAX,
          })}
        </p>
      )}
    </div>
  );
}
