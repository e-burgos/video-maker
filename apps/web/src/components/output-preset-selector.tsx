import type { OutputPreset } from '@video-maker/timeline-core';

import { OUTPUT_PRESETS, OUTPUT_PRESET_DETAILS } from '../api/output-presets';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';

export { OUTPUT_PRESETS };

export type OutputPresetSelectorProps = {
  preset: OutputPreset;
  dispatch: (action: TimelineEditAction) => void;
};

export function OutputPresetSelector({ preset, dispatch }: OutputPresetSelectorProps) {
  const t = useT();

  return (
    <label className="flex items-center gap-2 text-sm text-slate-400">
      {t('outputPreset.label')}
      <select
        aria-label={t('outputPreset.label')}
        value={preset}
        onChange={(event) =>
          dispatch({ type: 'output-preset', preset: event.target.value as OutputPreset })
        }
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
      >
        {OUTPUT_PRESET_DETAILS.map((detail) => (
          <option key={detail.name} value={detail.name}>
            {t(detail.labelKey)} · {detail.name}
          </option>
        ))}
      </select>
    </label>
  );
}
