import type { OutputPreset } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';

export const OUTPUT_PRESETS = [
  'reels-9x16',
  'tiktok-9x16',
  'shorts-9x16',
  'youtube-16x9',
] as const satisfies readonly OutputPreset[];

export type OutputPresetSelectorProps = {
  preset: OutputPreset;
  dispatch: (action: TimelineEditAction) => void;
};

export function OutputPresetSelector({ preset, dispatch }: OutputPresetSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-400">
      Output preset — saved with the timeline
      <select
        aria-label="Output preset"
        value={preset}
        onChange={(event) =>
          dispatch({ type: 'output-preset', preset: event.target.value as OutputPreset })
        }
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
      >
        {OUTPUT_PRESETS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}
