import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { storyboardFixture } from '../api/__fixtures__/storyboard';
import { StoryboardCharacterSheet } from './storyboard-character-sheet';

describe('StoryboardCharacterSheet', () => {
  it('lists every character with its name and visual description', () => {
    render(<StoryboardCharacterSheet storyboard={storyboardFixture()} onChange={vi.fn()} />);

    expect((screen.getByLabelText('Name for character-01') as HTMLInputElement).value).toBe('Nina');
    expect(
      (screen.getByLabelText('Visual description for character-01') as HTMLTextAreaElement).value,
    ).toContain('mustard hoodie');
  });

  it('emits the edited document for both fields of a character', () => {
    const onChange = vi.fn();
    render(<StoryboardCharacterSheet storyboard={storyboardFixture()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Name for character-01'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Visual description for character-01'), {
      target: { value: 'Woman in a green raincoat.' },
    });

    expect(onChange.mock.calls[0]?.[0].characters[0].name).toBe('Nadia');
    expect(onChange.mock.calls[1]?.[0].characters[0].visualDescription).toBe(
      'Woman in a green raincoat.',
    );
  });

  it('says so when the storyboard has no recurring characters', () => {
    render(
      <StoryboardCharacterSheet
        storyboard={{ ...storyboardFixture(), characters: [] }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('This storyboard has no recurring characters.')).toBeTruthy();
  });
});
