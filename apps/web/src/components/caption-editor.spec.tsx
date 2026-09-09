import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaptionClip } from '@video-maker/timeline-core';

import { CaptionEditor } from './caption-editor';

function captionClip(overrides: Partial<CaptionClip> & Pick<CaptionClip, 'id'>): CaptionClip {
  return {
    from: 0,
    durationFrames: 30,
    words: [
      { text: 'hello', fromFrame: 0, durationFrames: 10 },
      { text: 'world', fromFrame: 10, durationFrames: 10 },
    ],
    ...overrides,
  };
}

describe('CaptionEditor', () => {
  it('shows one text field per word, populated with the current text', () => {
    render(
      <CaptionEditor
        captions={[captionClip({ id: 'caption-0001' })]}
        dispatch={vi.fn()}
      />,
    );

    const first = screen.getByLabelText('Word 1 of caption-0001') as HTMLInputElement;
    const second = screen.getByLabelText('Word 2 of caption-0001') as HTMLInputElement;
    expect(first.value).toBe('hello');
    expect(second.value).toBe('world');
  });

  it('offers no controls for fromFrame, durationFrames, emphasisIndex or box, and no add/remove actions', () => {
    render(
      <CaptionEditor
        captions={[
          captionClip({
            id: 'caption-0001',
            emphasisIndex: 1,
            box: { x: 60, y: 220, width: 880, height: 1300 },
          }),
        ]}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('dispatches caption-word-text with the exact clipId, wordIndex and new text on change', () => {
    const dispatch = vi.fn();
    render(
      <CaptionEditor
        captions={[captionClip({ id: 'caption-0001' })]}
        dispatch={dispatch}
      />,
    );

    fireEvent.change(screen.getByLabelText('Word 2 of caption-0001'), { target: { value: 'there' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'caption-word-text',
      clipId: 'caption-0001',
      wordIndex: 1,
      text: 'there',
    });
  });

  it('renders each caption group and keeps word indices scoped to their own clip', () => {
    const dispatch = vi.fn();
    render(
      <CaptionEditor
        captions={[
          captionClip({ id: 'caption-0001' }),
          captionClip({ id: 'caption-0002', words: [{ text: 'again', fromFrame: 0, durationFrames: 10 }] }),
        ]}
        dispatch={dispatch}
      />,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Word 1 of caption-0002'), { target: { value: 'once' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'caption-word-text',
      clipId: 'caption-0002',
      wordIndex: 0,
      text: 'once',
    });
  });

  it('renders nothing when there are no captions', () => {
    render(<CaptionEditor captions={[]} dispatch={vi.fn()} />);

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
