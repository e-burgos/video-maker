import { MUSIC_FLOOR_DB_MAX, MUSIC_FLOOR_DB_MIN, MUSIC_MODES } from '../api/motion-types';
import type { MusicMode } from '../api/motion-types';
import { floorDbIssue } from '../api/music-mode';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

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

export function MusicModeFields({ mode, floorText, onModeChange, onFloorTextChange }: MusicModeFieldsProps) {
  const t = useT();
  const invalid = mode === 'segments' && floorDbIssue(floorText);

  return (
    <div data-testid="music-mode-fields" className="space-y-1">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('musicMode.label')}
          <select
            aria-label={t('musicMode.label')}
            value={mode}
            onChange={(event) => onModeChange(event.target.value as MusicMode)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          >
            {MUSIC_MODES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(MODE_KEYS[candidate])}
              </option>
            ))}
          </select>
        </label>

        {mode === 'segments' && (
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            {t('musicMode.floor')}
            <input
              type="text"
              inputMode="decimal"
              aria-label={t('musicMode.floor')}
              value={floorText}
              onChange={(event) => onFloorTextChange(event.target.value)}
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
            />
          </label>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {mode === 'segments' ? t('musicMode.segmentsHint') : t('musicMode.bedHint')}
      </p>

      {invalid && (
        <p role="alert" className="font-mono text-xs text-amber-300">
          {t('musicMode.floorInvalid', { min: MUSIC_FLOOR_DB_MIN, max: MUSIC_FLOOR_DB_MAX })}
        </p>
      )}
    </div>
  );
}
