import type { VideoClip } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';

export type ClipTrackEditorProps = {
  track: 'aroll' | 'broll';
  clips: readonly VideoClip[];
  dispatch: (action: TimelineEditAction) => void;
};

export function ClipTrackEditor({ track, clips, dispatch }: ClipTrackEditorProps) {
  return (
    <ol className="space-y-2">
      {clips.map((clip, index) => (
        <li
          key={clip.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
        >
          <span className="font-mono text-xs text-slate-500">{clip.id}</span>

          <label className="flex items-center gap-2 text-sm text-slate-400">
            Trim start (ms)
            <input
              type="number"
              aria-label={`Trim start for ${clip.id}`}
              value={clip.trimStartMs}
              onChange={(event) =>
                dispatch({
                  type: 'clip-trim-start',
                  track,
                  clipId: clip.id,
                  trimStartMs: Number(event.target.value),
                })
              }
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-400">
            Duration (frames)
            <input
              type="number"
              aria-label={`Duration for ${clip.id}`}
              value={clip.durationFrames}
              onChange={(event) =>
                dispatch({
                  type: 'clip-duration',
                  track,
                  clipId: clip.id,
                  durationFrames: Number(event.target.value),
                })
              }
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-sm text-slate-100"
            />
          </label>

          {track === 'aroll' && (
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Move ${clip.id} up`}
                disabled={index === 0}
                onClick={() => dispatch({ type: 'aroll-move', clipId: clip.id, toIndex: index - 1 })}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                Move up
              </button>
              <button
                type="button"
                aria-label={`Move ${clip.id} down`}
                disabled={index === clips.length - 1}
                onClick={() => dispatch({ type: 'aroll-move', clipId: clip.id, toIndex: index + 1 })}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                Move down
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
