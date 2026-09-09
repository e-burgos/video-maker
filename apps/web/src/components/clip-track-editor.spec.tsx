import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { VideoClip } from '@video-maker/timeline-core';

import { ClipTrackEditor } from './clip-track-editor';

function clip(overrides: Partial<VideoClip> & Pick<VideoClip, 'id'>): VideoClip {
  return {
    assetId: 'raw/aroll/clip01.mp4',
    from: 0,
    durationFrames: 90,
    trimStartMs: 0,
    transform: { scale: 1, translateX: 0, translateY: 0 },
    ...overrides,
  };
}

describe('ClipTrackEditor', () => {
  it('shows exactly two editable controls per clip and none for assetId, transform, fit or muted', () => {
    const clips = [clip({ id: 'aroll-0001' }), clip({ id: 'aroll-0002', from: 90 })];
    render(<ClipTrackEditor track="aroll" clips={clips} dispatch={vi.fn()} />);

    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByLabelText('Trim start for aroll-0001')).toBeTruthy();
    expect(screen.getByLabelText('Duration for aroll-0001')).toBeTruthy();
    expect(screen.getByLabelText('Trim start for aroll-0002')).toBeTruthy();
    expect(screen.getByLabelText('Duration for aroll-0002')).toBeTruthy();
  });

  it('shows reorder buttons only for the aroll track', () => {
    const clips = [clip({ id: 'aroll-0001' })];
    const { rerender } = render(<ClipTrackEditor track="aroll" clips={clips} dispatch={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);

    rerender(<ClipTrackEditor track="broll" clips={clips} dispatch={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('dispatches clip-trim-start with the parsed value and the given track on change', () => {
    const dispatch = vi.fn();
    render(<ClipTrackEditor track="aroll" clips={[clip({ id: 'aroll-0001' })]} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText('Trim start for aroll-0001'), { target: { value: '250' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'clip-trim-start',
      track: 'aroll',
      clipId: 'aroll-0001',
      trimStartMs: 250,
    });
  });

  it('dispatches clip-duration with the parsed value and the given track on change', () => {
    const dispatch = vi.fn();
    render(<ClipTrackEditor track="broll" clips={[clip({ id: 'broll-0001' })]} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText('Duration for broll-0001'), { target: { value: '45' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'clip-duration',
      track: 'broll',
      clipId: 'broll-0001',
      durationFrames: 45,
    });
  });

  it('dispatches aroll-move with the target index on move up and move down', () => {
    const dispatch = vi.fn();
    const clips = [clip({ id: 'aroll-0001' }), clip({ id: 'aroll-0002' }), clip({ id: 'aroll-0003' })];
    render(<ClipTrackEditor track="aroll" clips={clips} dispatch={dispatch} />);

    fireEvent.click(screen.getByLabelText('Move aroll-0002 up'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'aroll-move', clipId: 'aroll-0002', toIndex: 0 });

    fireEvent.click(screen.getByLabelText('Move aroll-0002 down'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'aroll-move', clipId: 'aroll-0002', toIndex: 2 });
  });

  it('disables move up on the first clip and move down on the last clip', () => {
    const clips = [clip({ id: 'aroll-0001' }), clip({ id: 'aroll-0002' })];
    render(<ClipTrackEditor track="aroll" clips={clips} dispatch={vi.fn()} />);

    expect(screen.getByLabelText('Move aroll-0001 up').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Move aroll-0001 down').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Move aroll-0002 up').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Move aroll-0002 down').hasAttribute('disabled')).toBe(true);
  });

  it('renders nothing when the track has no clips', () => {
    render(<ClipTrackEditor track="aroll" clips={[]} dispatch={vi.fn()} />);

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });
});
