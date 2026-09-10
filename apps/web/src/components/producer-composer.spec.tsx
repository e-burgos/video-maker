import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProducerComposer } from './producer-composer';

function renderComposer(overrides: Partial<Parameters<typeof ProducerComposer>[0]> = {}) {
  const onChange = vi.fn();
  const onSend = vi.fn();

  render(
    <ProducerComposer
      value="Proponeme un video de 30 segundos"
      onChange={onChange}
      onSend={onSend}
      pending={false}
      blockers={[]}
      {...overrides}
    />,
  );

  return { onChange, onSend };
}

function textarea(): HTMLTextAreaElement {
  return screen.getByLabelText('Message for the producer') as HTMLTextAreaElement;
}

function sendButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Send|Sending/ }) as HTMLButtonElement;
}

describe('ProducerComposer', () => {
  it('reports every keystroke upwards: the draft belongs to the page', () => {
    const { onChange } = renderComposer();

    fireEvent.change(textarea(), { target: { value: 'otra cosa' } });

    expect(onChange).toHaveBeenCalledWith('otra cosa');
  });

  it('sends with the button', () => {
    const { onSend } = renderComposer();

    fireEvent.click(sendButton());

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('sends with Enter and adds a line with Shift+Enter', () => {
    const { onSend } = renderComposer();

    fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea(), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('refuses to send an empty or blank draft', () => {
    const { onSend } = renderComposer({ value: '   ' });

    expect(sendButton().disabled).toBe(true);
    fireEvent.keyDown(textarea(), { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('holds the send while a turn is starting', () => {
    const { onSend } = renderComposer({ pending: true });

    expect(sendButton().disabled).toBe(true);
    expect(sendButton().textContent).toBe('Sending…');
    fireEvent.keyDown(textarea(), { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('blocks the field with the reason written when the producer is not available', () => {
    const { onSend } = renderComposer({ blockers: ['Claude Code is not available.'] });

    expect(textarea().disabled).toBe(true);
    expect(sendButton().disabled).toBe(true);
    expect(screen.getByTestId('producer-blockers').textContent).toContain('Claude Code');
    fireEvent.keyDown(textarea(), { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });
});
