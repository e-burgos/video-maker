import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OutputPresetSelector } from './output-preset-selector';
import { MESSAGES_EN } from '../i18n/messages-en';

describe('OutputPresetSelector', () => {
  it('offers exactly the four OutputPresetSchema literals, no more and no fewer', () => {
    render(<OutputPresetSelector preset="reels-9x16" dispatch={vi.fn()} />);

    const select = screen.getByLabelText('Output preset — saved with the timeline') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);

    expect(options).toEqual(['reels-9x16', 'tiktok-9x16', 'shorts-9x16', 'youtube-16x9']);
  });

  it('offers no free-form fields for width, height or fps', () => {
    render(<OutputPresetSelector preset="reels-9x16" dispatch={vi.fn()} />);

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByLabelText(/width/i)).toBeNull();
    expect(screen.queryByLabelText(/height/i)).toBeNull();
    expect(screen.queryByLabelText(/fps/i)).toBeNull();
  });

  it('shows the current persisted preset selected', () => {
    render(<OutputPresetSelector preset="youtube-16x9" dispatch={vi.fn()} />);

    expect((screen.getByLabelText('Output preset — saved with the timeline') as HTMLSelectElement).value).toBe('youtube-16x9');
  });

  it('dispatches output-preset with the exact chosen preset on change', () => {
    const dispatch = vi.fn();
    render(<OutputPresetSelector preset="reels-9x16" dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText('Output preset — saved with the timeline'), { target: { value: 'youtube-16x9' } });

    expect(dispatch).toHaveBeenCalledWith({ type: 'output-preset', preset: 'youtube-16x9' });
  });

  it('labels itself as the persisted preset, distinguishable from a preview-only override', () => {
    render(<OutputPresetSelector preset="reels-9x16" dispatch={vi.fn()} />);

    expect(screen.getByText('Output preset — saved with the timeline')).toBeTruthy();
  });

  it('names every preset in words and keeps its contract id visible next to it', () => {
    render(<OutputPresetSelector preset="reels-9x16" dispatch={vi.fn()} />);

    const select = screen.getByLabelText(
      'Output preset — saved with the timeline',
    ) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      `${MESSAGES_EN['outputPreset.reels-9x16.label']} · reels-9x16`,
      `${MESSAGES_EN['outputPreset.tiktok-9x16.label']} · tiktok-9x16`,
      `${MESSAGES_EN['outputPreset.shorts-9x16.label']} · shorts-9x16`,
      `${MESSAGES_EN['outputPreset.youtube-16x9.label']} · youtube-16x9`,
    ]);
  });
});
