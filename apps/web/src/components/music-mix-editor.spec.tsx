import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MusicMixSettings } from '@video-maker/timeline-core';

import { MusicMixEditor } from './music-mix-editor';

const music: MusicMixSettings = {
  baseGainDb: -12,
  duckedGainDb: -24,
  attackMs: 150,
  releaseMs: 400,
  holdMs: 250,
};

describe('MusicMixEditor', () => {
  it('shows exactly two controls, populated with the current base and ducked levels', () => {
    render(<MusicMixEditor music={music} dispatch={vi.fn()} />);

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect((screen.getByLabelText('Base level (dB)') as HTMLInputElement).value).toBe('-12');
    expect((screen.getByLabelText('Ducked level (dB)') as HTMLInputElement).value).toBe('-24');
  });

  it('offers no controls for attackMs, releaseMs, holdMs or audioMix.voice.*', () => {
    render(<MusicMixEditor music={music} dispatch={vi.fn()} />);

    expect(screen.queryByLabelText(/attack/i)).toBeNull();
    expect(screen.queryByLabelText(/release/i)).toBeNull();
    expect(screen.queryByLabelText(/hold/i)).toBeNull();
    expect(screen.queryByLabelText(/lufs/i)).toBeNull();
    expect(screen.queryByLabelText(/true.?peak/i)).toBeNull();
    expect(screen.queryByLabelText(/loudness range/i)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('dispatches music-levels with the new base level and the current ducked level unchanged', () => {
    const dispatch = vi.fn();
    render(<MusicMixEditor music={music} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText('Base level (dB)'), { target: { value: '-6' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'music-levels',
      baseGainDb: -6,
      duckedGainDb: -24,
    });
  });

  it('dispatches music-levels with the new ducked level and the current base level unchanged', () => {
    const dispatch = vi.fn();
    render(<MusicMixEditor music={music} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText('Ducked level (dB)'), { target: { value: '-30' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'music-levels',
      baseGainDb: -12,
      duckedGainDb: -30,
    });
  });
});
