import type { OutputPreset } from '@video-maker/timeline-core';

import { OUTPUT_PRESETS, OUTPUT_PRESET_DETAILS } from '../api/output-presets';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, INLINE_LABEL_CLASS } from './ui/cl-controls';

export { OUTPUT_PRESETS };

export type OutputPresetSelectorProps = {
  preset: OutputPreset;
  dispatch: (action: TimelineEditAction) => void;
};

export function OutputPresetSelector({ preset, dispatch }: OutputPresetSelectorProps) {
  const t = useT();

  return (
    <label className={`${INLINE_LABEL_CLASS} flex-col items-stretch gap-1`}>
      {t('outputPreset.label')}
      <select
        aria-label={t('outputPreset.label')}
        value={preset}
        onChange={(event) =>
          dispatch({ type: 'output-preset', preset: event.target.value as OutputPreset })
        }
        className={`${FIELD_CLASS} font-data`}
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
