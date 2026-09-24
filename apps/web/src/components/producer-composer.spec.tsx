import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { producerModels } from '../api/__fixtures__/producer';
import { ProducerComposer } from './producer-composer';

function renderComposer(overrides: Partial<Parameters<typeof ProducerComposer>[0]> = {}) {
  const onChange = vi.fn();
  const onSend = vi.fn();
  const onModelChange = vi.fn();

  render(
    <MemoryRouter>
      <ProducerComposer
        value="Proponeme un video de 30 segundos"
        onChange={onChange}
        onSend={onSend}
        pending={false}
        blockers={[]}
        models={producerModels().allowed}
        model="sonnet"
        onModelChange={onModelChange}
        {...overrides}
      />
    </MemoryRouter>,
  );

  return { onChange, onSend, onModelChange };
}

function modelPicker(): HTMLSelectElement {
  return screen.getByLabelText('model') as HTMLSelectElement;
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

  it('offers every allowed model with its description and reports the choice upwards', () => {
    const { onModelChange } = renderComposer();

    expect([...modelPicker().options].map((option) => option.value)).toEqual([
      'sonnet',
      'opus',
      'haiku',
    ]);
    expect(modelPicker().value).toBe('sonnet');
    expect(screen.getByTestId('producer-model-help').textContent).toBe('Balanced · faster, cheaper');

    fireEvent.change(modelPicker(), { target: { value: 'haiku' } });

    expect(onModelChange).toHaveBeenCalledWith('haiku');
  });

  it('shows the description of the model in use, not the one of the default', () => {
    renderComposer({ model: 'opus' });

    expect(modelPicker().value).toBe('opus');
    expect(screen.getByTestId('producer-model-help').textContent).toBe(
      'Most capable · slower, costlier',
    );
  });

  it('locks the model while a turn is starting and while the producer is not available', () => {
    renderComposer({ pending: true });
    expect(modelPicker().disabled).toBe(true);
  });

  it('blocks the field with the reason written when the producer is not available', () => {
    const { onSend } = renderComposer({ blockers: [{ key: 'producer.blocker.unavailable' }] });

    expect(textarea().disabled).toBe(true);
    expect(sendButton().disabled).toBe(true);
    expect(modelPicker().disabled).toBe(true);
    expect(screen.getByTestId('producer-blockers').textContent).toContain('Claude Code');
    fireEvent.keyDown(textarea(), { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('offers a link to settings when no producer engine is available', () => {
    renderComposer({ blockers: [{ key: 'producer.blocker.unavailable' }] });

    expect(screen.getByTestId('producer-composer-settings-link').getAttribute('href')).toBe(
      '/settings',
    );
  });

  it('does not show the settings link for an unrelated blocker', () => {
    renderComposer({ blockers: [{ key: 'producer.blocker.healthUnknown' }] });

    expect(screen.queryByTestId('producer-composer-settings-link')).toBeNull();
  });

  it('shows the active engine next to the model picker', () => {
    renderComposer({ activeEngine: 'openrouter' });

    expect(screen.getByTestId('producer-active-engine').textContent).toBe('with OpenRouter');
  });

  it('shows nothing about the engine when it is not known', () => {
    renderComposer({ activeEngine: null });

    expect(screen.queryByTestId('producer-active-engine')).toBeNull();
  });
});
