import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { producerTurn, succeededTurn } from '../api/__fixtures__/producer';
import { RenderApiError } from '../api/render-api-error';
import { ProducerTurnActivity, eventLabel, formatElapsed } from './producer-turn-activity';

function renderActivity(overrides: Partial<Parameters<typeof ProducerTurnActivity>[0]> = {}) {
  const onCancel = vi.fn();

  render(
    <ProducerTurnActivity
      turn={producerTurn()}
      polling
      error={null}
      canceling={false}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return onCancel;
}

describe('formatElapsed', () => {
  it('counts the turn in minutes and seconds', () => {
    expect(formatElapsed('2026-09-10T10:00:00.000Z', Date.parse('2026-09-10T10:03:07.000Z'))).toBe(
      '3:07',
    );
  });

  it('never goes negative when the clocks disagree', () => {
    expect(formatElapsed('2026-09-10T10:00:00.000Z', Date.parse('2026-09-10T09:59:00.000Z'))).toBe(
      '0:00',
    );
  });

  it('does not crash on a timestamp it cannot read', () => {
    expect(formatElapsed('not a date', Date.now())).toBe('—');
  });
});

describe('eventLabel', () => {
  it('shows the summary of a tool next to its name and the text of a message as written', () => {
    expect(eventLabel({ type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' })).toBe(
      'Bash · ffprobe raw/aroll/clip01.mp4',
    );
    expect(eventLabel({ type: 'text', text: 'reviso el material' })).toBe('reviso el material');
    expect(
      eventLabel({ type: 'text', text: 'Listo.\n```suggestions\n["Dale"]\n```\n' }),
    ).toBe('Listo.');
    expect(eventLabel({ type: 'status', status: 'tool failed' })).toBe('tool failed');
  });
});

describe('ProducerTurnActivity', () => {
  it('renders nothing while there is no turn and no error', () => {
    const { container } = render(
      <ProducerTurnActivity turn={null} polling={false} error={null} canceling={false} onCancel={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('lists every event of the running turn in order with its type', () => {
    renderActivity();

    const items = screen.getByTestId('producer-turn-events').querySelectorAll('li');
    expect([...items].map((item) => item.getAttribute('data-event-type'))).toEqual([
      'status',
      'tool',
      'text',
      'tool',
    ]);
    expect(items[1]?.textContent).toBe('Bash · ffprobe raw/aroll/clip01.mp4');
  });

  it('renders the markdown of a text event instead of showing it raw', () => {
    renderActivity({ turn: producerTurn({ events: [{ type: 'text', text: 'Listo, **material** revisado' }] }) });

    const item = screen.getByTestId('producer-turn-events').querySelector('li');
    expect(item?.textContent).toBe('Listo, material revisado');
    expect(item?.querySelector('strong')?.textContent).toBe('material');
  });

  it('says it is waiting while the turn has not reported a step yet', () => {
    renderActivity({ turn: producerTurn({ events: [] }) });

    expect(screen.getByTestId('producer-turn-events').textContent).toContain('waiting');
  });

  it('scrolls the feed to the last event', () => {
    renderActivity();

    const feed = screen.getByTestId('producer-turn-events');
    Object.defineProperty(feed, 'scrollHeight', { value: 400, configurable: true });

    expect(feed.scrollTop).toBeGreaterThanOrEqual(0);
  });

  it('offers Cancel only while the turn runs and reports the click upwards', () => {
    const onCancel = renderActivity();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('holds the Cancel button while the cancellation is in flight', () => {
    renderActivity({ canceling: true });

    expect((screen.getByRole('button', { name: 'Canceling…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('drops the Cancel button once the turn settled and reports the status', () => {
    renderActivity({ turn: succeededTurn(), polling: false });

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByTestId('producer-turn-activity').getAttribute('data-status')).toBe(
      'succeeded',
    );
  });

  it('explains a quota failure in the language of the user next to its code', () => {
    renderActivity({
      polling: false,
      turn: producerTurn({
        status: 'failed',
        finishedAt: '2026-09-10T10:02:00.000Z',
        error: { code: 'PRODUCER_RATE_LIMITED', stage: null, message: 'usage limit reached' },
      }),
    });

    const failure = screen.getByTestId('producer-turn-failure');
    expect(failure.textContent).toContain('PRODUCER_RATE_LIMITED');
    expect(failure.textContent).toContain('ran out of quota');
    expect(failure.textContent).toContain('conversation is saved');
  });

  it('falls back to the message of the service for a code it does not own', () => {
    renderActivity({
      polling: false,
      turn: producerTurn({
        status: 'failed',
        error: { code: 'INTERNAL_ERROR', stage: null, message: 'something broke' },
      }),
    });

    expect(screen.getByTestId('producer-turn-failure').textContent).toContain('something broke');
  });

  it('shows a transport failure of the polling itself', () => {
    renderActivity({ error: new RenderApiError('SERVICE_UNREACHABLE', 'no answer', null, null) });

    expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE');
  });
});

describe('ProducerTurnActivity — elapsed clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-09-10T10:00:11.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks the elapsed time while the turn runs', () => {
    renderActivity();

    expect(screen.getByTestId('producer-turn-elapsed').textContent).toBe('0:10');
  });
});
