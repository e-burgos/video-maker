import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { previewTimelineFixture } from '../api/__fixtures__/timeline';

vi.mock('@remotion/player', async () => {
  const { createElement } = await import('react');

  return {
    Player: (props: Record<string, unknown>) =>
      createElement(
        'div',
        {
          'data-testid': 'player-probe',
          'data-duration-in-frames': String(props['durationInFrames']),
          'data-fps': String(props['fps']),
          'data-composition-width': String(props['compositionWidth']),
          'data-composition-height': String(props['compositionHeight']),
          'data-controls': String(props['controls'] === true),
          'data-initial-frame': String(props['initialFrame']),
          'data-has-initial-frame': String('initialFrame' in props),
        },
        createElement(
          props['component'] as never,
          props['inputProps'] as Record<string, unknown>,
        ),
      ),
  };
});

vi.mock('@video-maker/composition-remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@video-maker/composition-remotion')>();
  const { createElement } = await import('react');

  const CompositionProbe = (props: { timeline: { id: string } }) =>
    createElement(
      'span',
      { 'data-testid': 'composition-probe', 'data-timeline-id': props.timeline.id },
      actual.useVideoBackend(),
    );

  return { ...actual, TimelineComposition: CompositionProbe };
});

const { TimelinePlayer } = await import('./timeline-player');

describe('TimelinePlayer', () => {
  it('monta la composicion bajo el backend de player, no el del render', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} />);

    expect(screen.getByTestId('composition-probe').textContent).toBe('player');
  });

  it('deriva la metadata del Player de computeTimelineMetadata y habilita los controles', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} />);

    const player = screen.getByTestId('player-probe');

    expect(player.getAttribute('data-duration-in-frames')).toBe('120');
    expect(player.getAttribute('data-fps')).toBe('30');
    expect(player.getAttribute('data-composition-width')).toBe('1080');
    expect(player.getAttribute('data-composition-height')).toBe('1920');
    expect(player.getAttribute('data-controls')).toBe('true');
  });

  it('pasa la timeline validada como inputProps, sin la clave audio', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} />);

    expect(screen.getByTestId('composition-probe').getAttribute('data-timeline-id')).toBe(
      'timeline-preview',
    );
  });

  it('expone la metadata en el contenedor para la verificacion visual', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} />);

    const container = screen.getByTestId('timeline-player');

    expect(container.getAttribute('data-duration-in-frames')).toBe('120');
    expect(container.getAttribute('data-fps')).toBe('30');
    expect(container.getAttribute('data-composition-width')).toBe('1080');
    expect(container.getAttribute('data-composition-height')).toBe('1920');
  });

  it('omits initialFrame from the Player when not given, preserving current behaviour', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} />);

    const player = screen.getByTestId('player-probe');
    expect(player.getAttribute('data-has-initial-frame')).toBe('false');
  });

  it('forwards initialFrame to the Player so a capture script can seek a deterministic frame', () => {
    render(<TimelinePlayer timeline={previewTimelineFixture()} initialFrame={240} />);

    const player = screen.getByTestId('player-probe');
    expect(player.getAttribute('data-has-initial-frame')).toBe('true');
    expect(player.getAttribute('data-initial-frame')).toBe('240');
  });

  it('defaults controls to true and turns them off when the capture script asks for it', () => {
    const { rerender } = render(<TimelinePlayer timeline={previewTimelineFixture()} controls={false} />);

    expect(screen.getByTestId('player-probe').getAttribute('data-controls')).toBe('false');

    rerender(<TimelinePlayer timeline={previewTimelineFixture()} />);
    expect(screen.getByTestId('player-probe').getAttribute('data-controls')).toBe('true');
  });
});
