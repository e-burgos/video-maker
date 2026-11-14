import type { CaptionClip } from '@video-maker/timeline-core';

import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import { FIELD_SMALL_CLASS, ROW_CLASS } from './ui/cl-controls';

export type CaptionEditorProps = {
  captions: readonly CaptionClip[];
  dispatch: (action: TimelineEditAction) => void;
};

export function CaptionEditor({ captions, dispatch }: CaptionEditorProps) {
  const t = useT();

  return (
    <ol className="space-y-2">
      {captions.map((caption) => (
        <li
          key={caption.id}
          className={ROW_CLASS}
        >
          <span className="font-data w-full text-xs text-[var(--cl-ink-3)]">{caption.id}</span>
          {caption.words.map((word, wordIndex) => (
            <input
              key={wordIndex}
              type="text"
              aria-label={t('caption.word', { index: wordIndex + 1, clipId: caption.id })}
              value={word.text}
              onChange={(event) =>
                dispatch({
                  type: 'caption-word-text',
                  clipId: caption.id,
                  wordIndex,
                  text: event.target.value,
                })
              }
              className={`${FIELD_SMALL_CLASS} w-24`}
            />
          ))}
        </li>
      ))}
    </ol>
  );
}
