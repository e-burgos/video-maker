import type { VideoClip } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { FIELD_SMALL_CLASS, INLINE_LABEL_CLASS, ROW_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type ClipTrackEditorProps = {
  track: 'aroll' | 'broll';
  clips: readonly VideoClip[];
  dispatch: (action: TimelineEditAction) => void;
};

export function ClipTrackEditor({ track, clips, dispatch }: ClipTrackEditorProps) {
  const t = useT();

  return (
    <ol className="space-y-2">
      {clips.map((clip, index) => (
        <li
          key={clip.id}
          className={ROW_CLASS}
        >
          <span className="font-data w-full text-xs text-[var(--cl-ink-3)]">{clip.id}</span>

          <label className={INLINE_LABEL_CLASS}>
            {t('clip.trimStart')}
            <input
              type="number"
              aria-label={t('clip.trimStartFor', { clipId: clip.id })}
              value={clip.trimStartMs}
              onChange={(event) =>
                dispatch({
                  type: 'clip-trim-start',
                  track,
                  clipId: clip.id,
                  trimStartMs: Number(event.target.value),
                })
              }
              className={`${FIELD_SMALL_CLASS} font-data w-24`}
            />
          </label>

          <label className={INLINE_LABEL_CLASS}>
            {t('clip.duration')}
            <input
              type="number"
              aria-label={t('clip.durationFor', { clipId: clip.id })}
              value={clip.durationFrames}
              onChange={(event) =>
                dispatch({
                  type: 'clip-duration',
                  track,
                  clipId: clip.id,
                  durationFrames: Number(event.target.value),
                })
              }
              className={`${FIELD_SMALL_CLASS} font-data w-24`}
            />
          </label>

          {track === 'aroll' && (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={t('clip.moveUpFor', { clipId: clip.id })}
                disabled={index === 0}
                onClick={() => dispatch({ type: 'aroll-move', clipId: clip.id, toIndex: index - 1 })}
                className={SECONDARY_BUTTON_SMALL_CLASS}
              >
                {t('clip.moveUp')}
              </button>
              <button
                type="button"
                aria-label={t('clip.moveDownFor', { clipId: clip.id })}
                disabled={index === clips.length - 1}
                onClick={() => dispatch({ type: 'aroll-move', clipId: clip.id, toIndex: index + 1 })}
                className={SECONDARY_BUTTON_SMALL_CLASS}
              >
                {t('clip.moveDown')}
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
