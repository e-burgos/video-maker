import type { MusicMixSettings } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';

export type MusicMixEditorProps = {
  music: MusicMixSettings;
  dispatch: (action: TimelineEditAction) => void;
};

export function MusicMixEditor({ music, dispatch }: MusicMixEditorProps) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <label className="flex items-center gap-2 text-sm text-slate-400">
        {t('music.baseLevel')}
        <input
          type="number"
          aria-label={t('music.baseLevel')}
          value={music.baseGainDb}
          onChange={(event) =>
            dispatch({
              type: 'music-levels',
              baseGainDb: Number(event.target.value),
              duckedGainDb: music.duckedGainDb,
            })
          }
          className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-400">
        {t('music.duckedLevel')}
        <input
          type="number"
          aria-label={t('music.duckedLevel')}
          value={music.duckedGainDb}
          onChange={(event) =>
            dispatch({
              type: 'music-levels',
              baseGainDb: music.baseGainDb,
              duckedGainDb: Number(event.target.value),
            })
          }
          className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
        />
      </label>
    </div>
  );
}
