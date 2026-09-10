import { describe, expect, it } from 'vitest';

import {
  appendProducerMessageToMarkdown,
  producerConversationHeading,
  producerMessageBullet,
  toSingleLine,
} from './producer-conversation-markdown';
import type { ProducerMessage } from './producer-documents';

const USER: ProducerMessage = {
  id: 'msg-0001',
  role: 'user',
  text: 'publicidad para una óptica con las fotos y videos de raw/',
  createdAt: '2026-09-10T10:00:00.000Z',
};

const ASSISTANT: ProducerMessage = {
  id: 'msg-0002',
  role: 'assistant',
  text: 'Inventario:\n\n- 1 A-roll\n- 3 fotos',
  createdAt: '2026-09-10T10:02:00.000Z',
  suggestions: ['Dale'],
};

describe('producerConversationHeading', () => {
  it('reproduce el encabezado del conversation.md escrito a mano, con la fecha sin la hora', () => {
    expect(producerConversationHeading('demo-01', '2026-09-10T10:00:00.000Z')).toBe(
      '# demo-01 — conversación con el productor (2026-09-10)\n',
    );
  });
});

describe('producerMessageBullet', () => {
  it('etiqueta al usuario y al productor como el archivo existente', () => {
    expect(producerMessageBullet(USER)).toBe(
      '- Usuario: publicidad para una óptica con las fotos y videos de raw/\n',
    );
    expect(producerMessageBullet(ASSISTANT)).toBe('- Productor: Inventario: - 1 A-roll - 3 fotos\n');
  });

  it('colapsa los saltos de línea para que cada mensaje sea una sola viñeta', () => {
    expect(toSingleLine('  uno\n\n  dos\ttres  ')).toBe('uno dos tres');
  });
});

describe('appendProducerMessageToMarkdown', () => {
  it('crea el archivo con encabezado, línea en blanco y la primera viñeta', () => {
    expect(appendProducerMessageToMarkdown(null, 'demo-01', USER)).toBe(
      '# demo-01 — conversación con el productor (2026-09-10)\n\n- Usuario: publicidad para una óptica con las fotos y videos de raw/\n',
    );
  });

  it('trata un archivo en blanco como inexistente', () => {
    expect(appendProducerMessageToMarkdown('   \n', 'demo-01', USER)).toBe(
      appendProducerMessageToMarkdown(null, 'demo-01', USER),
    );
  });

  it('agrega la viñeta al final del archivo existente sin reescribir el encabezado', () => {
    const existing = '# demo-01 — conversación con el productor (2026-09-09)\n\n- Usuario: hola\n';
    expect(appendProducerMessageToMarkdown(existing, 'demo-01', ASSISTANT)).toBe(
      `${existing}- Productor: Inventario: - 1 A-roll - 3 fotos\n`,
    );
  });

  it('separa con un salto cuando el archivo existente no termina en newline', () => {
    expect(appendProducerMessageToMarkdown('- Usuario: hola', 'demo-01', ASSISTANT)).toBe(
      '- Usuario: hola\n- Productor: Inventario: - 1 A-roll - 3 fotos\n',
    );
  });
});
