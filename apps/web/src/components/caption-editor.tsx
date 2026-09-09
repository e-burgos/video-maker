import type { CaptionClip } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';

export type CaptionEditorProps = {
  captions: readonly CaptionClip[];
  dispatch: (action: TimelineEditAction) => void;
};

export function CaptionEditor({ captions, dispatch }: CaptionEditorProps) {
  return (
    <ol className="space-y-2">
      {captions.map((caption) => (
        <li
          key={caption.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
        >
          <span className="font-mono text-xs text-slate-500">{caption.id}</span>
          {caption.words.map((word, wordIndex) => (
            <input
              key={wordIndex}
              type="text"
              aria-label={`Word ${wordIndex + 1} of ${caption.id}`}
              value={word.text}
              onChange={(event) =>
                dispatch({
                  type: 'caption-word-text',
                  clipId: caption.id,
                  wordIndex,
                  text: event.target.value,
                })
              }
              className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            />
          ))}
        </li>
      ))}
    </ol>
  );
}
