import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { storyboardFixture } from '../api/__fixtures__/storyboard';
import { StoryboardHeaderEditor } from './storyboard-header-editor';
import type { StoryboardDocument } from '@video-maker/timeline-core';

function renderEditor(storyboard: StoryboardDocument = storyboardFixture()) {
  const onChange = vi.fn();
  render(<StoryboardHeaderEditor storyboard={storyboard} onChange={onChange} />);
  return onChange;
}

describe('StoryboardHeaderEditor', () => {
  it('shows the stored header, with the tags as a comma separated list', () => {
    renderEditor();

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toContain('Tres trucos');
    expect((screen.getByLabelText('Language') as HTMLInputElement).value).toBe('es-AR');
    expect((screen.getByLabelText('Format') as HTMLSelectElement).value).toBe('9:16');
    expect((screen.getByLabelText('Music tags') as HTMLInputElement).value).toBe('upbeat, tech');
  });

  it('emits a new document for each header field, never mutating the current one', () => {
    const storyboard = storyboardFixture();
    const onChange = renderEditor(storyboard);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Otro título' } });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en-US' } });
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: '16:9' } });
    fireEvent.change(screen.getByLabelText('Caption style'), { target: { value: 'clean white' } });
    fireEvent.change(screen.getByLabelText('Music tags'), { target: { value: 'calm, warm' } });

    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange.mock.calls[0]?.[0].title).toBe('Otro título');
    expect(onChange.mock.calls[1]?.[0].language).toBe('en-US');
    expect(onChange.mock.calls[2]?.[0].format).toBe('16:9');
    expect(onChange.mock.calls[3]?.[0].captionsStyle).toBe('clean white');
    expect(onChange.mock.calls[4]?.[0].musicTags).toEqual(['calm', 'warm']);
    expect(storyboard.title).toBe(storyboardFixture().title);
  });

  it('offers the three formats the storyboard schema accepts', () => {
    renderEditor();

    const options = Array.from(
      (screen.getByLabelText('Format') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).toEqual(['9:16', '16:9', '1:1']);
  });
});
