import type { CaptionWordState } from './caption-word-style';
import type { CaptionWord } from './timeline-types';

export interface CaptionWordRender {
  text: string;
  state: CaptionWordState;
}

export function activeWordIndex(frame: number, words: readonly CaptionWord[]): number {
  return words.findIndex(
    (word) => frame >= word.fromFrame && frame < word.fromFrame + word.durationFrames,
  );
}

export function captionWordRenders(
  frame: number,
  words: readonly CaptionWord[],
  emphasisIndex: number | null,
): readonly CaptionWordRender[] {
  const activeIndex = activeWordIndex(frame, words);

  return words.map((word, index) => ({
    text: word.text,
    state: { isEmphasis: index === emphasisIndex, isActive: index === activeIndex },
  }));
}
