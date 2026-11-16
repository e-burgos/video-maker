import type { MusicMixSettings } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { FIELD_SMALL_CLASS, INLINE_LABEL_CLASS } from './ui/cl-controls';

export type MusicMixEditorProps = {
  music: MusicMixSettings;
  dispatch: (action: TimelineEditAction) => void;
};

export function MusicMixEditor({ music, dispatch }: MusicMixEditorProps) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className={INLINE_LABEL_CLASS}>
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
          className={`${FIELD_SMALL_CLASS} font-data w-20`}
        />
      </label>

      <label className={INLINE_LABEL_CLASS}>
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
          className={`${FIELD_SMALL_CLASS} font-data w-20`}
        />
      </label>
    </div>
  );
}
