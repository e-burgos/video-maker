import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ASSISTANT_ANSWER, producerMessage } from '../api/__fixtures__/producer';
import { ProducerMessageList, quickRepliesOf } from './producer-message-list';
import type { ProducerMessage } from '../api/render-api-types';
import { LANGUAGE_STORAGE_KEY } from '../i18n/language';
import { LanguageProvider } from '../i18n/language-context';

function renderList(messages: ProducerMessage[], quickRepliesDisabled = false) {
  const onQuickReply = vi.fn();
  render(
    <ProducerMessageList
      messages={messages}
      onQuickReply={onQuickReply}
      quickRepliesDisabled={quickRepliesDisabled}
    />,
  );
  return onQuickReply;
}

async function renderListInLanguage(language: 'en' | 'es', messages: ProducerMessage[]) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  render(
    <LanguageProvider>
      <ProducerMessageList messages={messages} onQuickReply={vi.fn()} quickRepliesDisabled={false} />
    </LanguageProvider>,
  );
  await waitFor(() => {
    expect(document.documentElement.lang).toBe(language);
  });
}

const assistant = producerMessage({
  id: 'msg-0002',
  role: 'assistant',
  text: ASSISTANT_ANSWER,
  suggestions: ['Dale, avanzá'],
});

describe('ProducerMessageList', () => {
  it('renders the markdown of the answer instead of showing its markers', () => {
    renderList([assistant]);

    expect(screen.getByText('3 clips').tagName).toBe('STRONG');
    expect(
      screen
        .getAllByText('Un corte de 30 segundos con la música de fondo.')
        .map((element) => element.closest('li,button')?.tagName),
    ).toEqual(['LI', 'BUTTON']);
    expect(screen.queryByText(/\*\*/u)).toBeNull();
  });

  it('marks each message with its role so the two sides read apart', () => {
    renderList([producerMessage(), assistant]);

    expect(screen.getByTestId('producer-message-msg-0001').getAttribute('data-role')).toBe('user');
    expect(screen.getByTestId('producer-message-msg-0002').getAttribute('data-role')).toBe(
      'assistant',
    );
  });

  it('sends the suggestion text as written when a chip is clicked', () => {
    const onQuickReply = renderList([assistant]);

    fireEvent.click(screen.getByRole('button', { name: 'Dale, avanzá' }));

    expect(onQuickReply).toHaveBeenCalledWith('Dale, avanzá');
  });

  it('turns the numbered options of the answer into quick replies too', () => {
    renderList([assistant]);

    expect(
      screen.getByRole('button', { name: 'Un corte de 30 segundos con la música de fondo.' }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Un corte de 45 segundos con más B-roll.' }),
    ).toBeDefined();
  });

  it('offers the chips of the last answer only, never those of an old turn', () => {
    renderList([assistant, producerMessage({ id: 'msg-0003', text: 'y ahora?' })]);

    expect(screen.queryByTestId('producer-suggestions')).toBeNull();
  });

  it('disables the chips while another turn is running', () => {
    renderList([assistant], true);

    expect((screen.getByRole('button', { name: 'Dale, avanzá' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows nothing but the list for an empty conversation', () => {
    renderList([]);

    expect(screen.getByTestId('producer-message-list').childElementCount).toBe(0);
  });

  it('shows the cost of a turn that reports one', () => {
    renderList([
      producerMessage({
        role: 'assistant',
        text: 'listo',
        usage: { inputTokens: 120, outputTokens: 40, costUsd: 0.0123 },
      }),
    ]);

    expect(screen.getByTestId('producer-message-cost-msg-0001').textContent).toBe('≈ US$ 0.012');
  });

  it('shows nothing about cost when the message does not report one', () => {
    renderList([assistant]);

    expect(screen.queryByTestId('producer-message-cost-msg-0002')).toBeNull();
  });

  it('formats the cost with a period in English', async () => {
    const message = producerMessage({
      role: 'assistant',
      text: 'listo',
      usage: { inputTokens: 120, outputTokens: 40, costUsd: 0.0123 },
    });

    await renderListInLanguage('en', [message]);
    expect(screen.getByTestId('producer-message-cost-msg-0001').textContent).toBe('≈ US$ 0.012');
  });

  it('formats the cost with a comma in Spanish', async () => {
    const message = producerMessage({
      role: 'assistant',
      text: 'listo',
      usage: { inputTokens: 120, outputTokens: 40, costUsd: 0.0123 },
    });

    await renderListInLanguage('es', [message]);
    expect(screen.getByTestId('producer-message-cost-msg-0001').textContent).toBe('≈ US$ 0,012');
  });

  afterEach(() => {
    window.localStorage.clear();
  });
});

describe('ProducerMessageList — the shapes the producer actually emits', () => {
  it('draws a real table instead of a wall of pipes', () => {
    renderList([
      producerMessage({
        role: 'assistant',
        text: '| Archivo | Duración |\n|---|---|\n| clip01.mp4 | 26 s |',
      }),
    ]);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Archivo' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'clip01.mp4' })).toBeTruthy();
  });

  it('draws a fenced block as preformatted text, keeping its line breaks', () => {
    renderList([
      producerMessage({ role: 'assistant', text: '```\nlinea uno\nlinea dos\n```' }),
    ]);

    const block = document.querySelector('pre');
    expect(block?.textContent).toBe('linea uno\nlinea dos');
  });

  it('draws a rule instead of printing three dashes', () => {
    renderList([producerMessage({ role: 'assistant', text: 'arriba\n\n---\n\nabajo' })]);

    expect(document.querySelectorAll('hr')).toHaveLength(1);
    expect(screen.queryByText('---')).toBeNull();
  });

  it('draws a heading with its level, without the hashes', () => {
    renderList([producerMessage({ role: 'assistant', text: '## Inventario\n\ntexto' })]);

    expect(screen.getByRole('heading', { level: 2, name: 'Inventario' })).toBeTruthy();
    expect(screen.queryByText('## Inventario')).toBeNull();
  });

  it('draws an inline code span as code, without its backticks', () => {
    renderList([producerMessage({ role: 'assistant', text: 'corré `--seed 1`' })]);

    expect(screen.getByText('--seed 1').tagName).toBe('CODE');
  });
});

describe('quickRepliesOf', () => {
  it('does not offer the same text twice when a suggestion repeats a numbered option', () => {
    const message = producerMessage({
      role: 'assistant',
      text: '1. Un corte de 30 s.\n2. Un corte de 45 s.',
      suggestions: ['Un corte de 30 s.'],
    });

    expect(quickRepliesOf(message)).toEqual(['Un corte de 30 s.', 'Un corte de 45 s.']);
  });

  it('returns nothing for a message without suggestions or numbered options', () => {
    expect(quickRepliesOf(producerMessage({ role: 'assistant', text: 'listo' }))).toEqual([]);
  });
});
