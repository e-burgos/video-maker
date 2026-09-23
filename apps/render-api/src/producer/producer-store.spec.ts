import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { ProducerMessage } from './producer-documents';
import {
  appendProducerConversationMarkdown,
  appendProducerMessage,
  readProducerConversation,
  readProducerSession,
  writeProducerSession,
  writeProducerTurnLog,
} from './producer-store';

const PROJECT = resolveMediaProject('/media/demo-01');
const MARKDOWN = '/media/demo-01/work/producer/conversation.md';

const MESSAGE: ProducerMessage = {
  id: 'msg-0001',
  role: 'user',
  text: 'Contame qué material hay',
  createdAt: '2026-09-10T10:00:00.000Z',
};

function depsWith(files: readonly FakeObjectStorageFileSeed[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/demo-01', '/media/demo-01/work'],
    files,
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  deps.localStore.projects.insert('demo-01');
  return { callLog, storage, deps };
}

describe('readProducerConversation', () => {
  it('devuelve la conversación vacía cuando el proyecto nunca habló con el productor', () => {
    const { deps } = depsWith();
    expect(readProducerConversation(deps, PROJECT)).toEqual([]);
  });

  it('lee los mensajes persistidos en orden', () => {
    const { deps } = depsWith();
    appendProducerMessage(deps, PROJECT, MESSAGE);
    appendProducerMessage(deps, PROJECT, { ...MESSAGE, id: 'msg-0002', role: 'assistant', text: 'listo' });

    expect(readProducerConversation(deps, PROJECT).map((message) => message.id)).toEqual([
      'msg-0001',
      'msg-0002',
    ]);
  });
});

describe('appendProducerMessage', () => {
  it('persiste el mensaje en la base y lo deja releíble por readProducerConversation', () => {
    const { deps } = depsWith();
    appendProducerMessage(deps, PROJECT, MESSAGE);

    expect(readProducerConversation(deps, PROJECT)).toEqual([MESSAGE]);
  });
});

describe('readProducerSession y writeProducerSession', () => {
  it('es null sin sesión previa y devuelve la sesión con los mismos campos que antes', () => {
    const { deps } = depsWith();
    expect(readProducerSession(deps, PROJECT)).toBeNull();

    const session = {
      sessionId: '11111111-2222-3333-4444-555555555555',
      model: 'sonnet',
      createdAt: '2026-09-10T10:00:00.000Z',
      lastTurnAt: '2026-09-10T10:00:00.000Z',
    };
    writeProducerSession(deps, PROJECT, session);

    expect(readProducerSession(deps, PROJECT)).toEqual(session);
  });

  it('sobrescribe la sesión anterior del mismo proyecto', () => {
    const { deps } = depsWith();
    writeProducerSession(deps, PROJECT, {
      sessionId: 's1',
      model: 'sonnet',
      createdAt: 'a',
      lastTurnAt: 'a',
    });
    writeProducerSession(deps, PROJECT, {
      sessionId: 's1',
      model: 'opus',
      createdAt: 'a',
      lastTurnAt: 'b',
    });

    expect(readProducerSession(deps, PROJECT)).toEqual({
      sessionId: 's1',
      model: 'opus',
      createdAt: 'a',
      lastTurnAt: 'b',
    });
  });
});

describe('appendProducerConversationMarkdown', () => {
  it('crea el markdown con el encabezado del proyecto', async () => {
    const { storage, deps } = depsWith();

    expect(await appendProducerConversationMarkdown(deps, PROJECT, MESSAGE)).toBe(
      'work/producer/conversation.md',
    );
    expect(await storage.readTextFile(MARKDOWN)).toBe(
      '# demo-01 — conversación con el productor (2026-09-10)\n\n- Usuario: Contame qué material hay\n',
    );
  });

  it('agrega al final del markdown que el productor escribió a mano', async () => {
    const existing = '# demo-01 — conversación con el productor (2026-09-10)\n\n- Usuario: hola\n';
    const { storage, deps } = depsWith([{ path: MARKDOWN, contents: existing }]);

    await appendProducerConversationMarkdown(deps, PROJECT, {
      ...MESSAGE,
      id: 'msg-0002',
      role: 'assistant',
      text: 'buenas',
    });

    expect(await storage.readTextFile(MARKDOWN)).toBe(`${existing}- Productor: buenas\n`);
  });
});

describe('writeProducerTurnLog', () => {
  it('escribe un evento crudo por línea, con newline final', async () => {
    const { storage, deps } = depsWith();

    const relativePath = await writeProducerTurnLog(deps, PROJECT, 'turn-0001', [
      '{"type":"system"}',
      '{"type":"assistant"}',
    ]);

    expect(relativePath).toBe('work/producer/turns/turn-0001.jsonl');
    expect(await storage.readTextFile('/media/demo-01/work/producer/turns/turn-0001.jsonl')).toBe(
      '{"type":"system"}\n{"type":"assistant"}\n',
    );
  });

  it('escribe un archivo vacío cuando el turno no produjo ni un evento', async () => {
    const { storage, deps } = depsWith();
    await writeProducerTurnLog(deps, PROJECT, 'turn-0002', []);
    expect(await storage.readTextFile('/media/demo-01/work/producer/turns/turn-0002.jsonl')).toBe('');
  });
});
