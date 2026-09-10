import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { isRenderApiError } from '../errors/render-api-error';
import type { ProducerMessage } from './producer-documents';
import {
  appendProducerConversationMarkdown,
  readProducerConversation,
  readProducerSession,
  writeProducerConversation,
  writeProducerSession,
  writeProducerTurnLog,
} from './producer-store';

const PROJECT = resolveMediaProject('/media/demo-01');
const CONVERSATION = '/media/demo-01/work/producer/conversation.json';
const MARKDOWN = '/media/demo-01/work/producer/conversation.md';
const SESSION = '/media/demo-01/work/producer/session.json';

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
  return { callLog, storage, deps: createFakeRenderApiDependencies(callLog, { storage }) };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('readProducerConversation', () => {
  it('devuelve la conversación vacía cuando el proyecto nunca habló con el productor', async () => {
    const { deps } = depsWith();
    expect(await readProducerConversation(deps, PROJECT)).toEqual({ messages: [] });
  });

  it('lee el documento persistido', async () => {
    const { deps } = depsWith([
      { path: CONVERSATION, contents: serializeMontageDocument({ messages: [MESSAGE] }) },
    ]);
    expect((await readProducerConversation(deps, PROJECT)).messages).toHaveLength(1);
  });

  it('falla con PRODUCER_STATE_INVALID en vez de pisar una conversación ilegible', async () => {
    const { deps } = depsWith([{ path: CONVERSATION, contents: '{ no json' }]);
    expect(await codeOf(readProducerConversation(deps, PROJECT))).toBe('PRODUCER_STATE_INVALID');
  });
});

describe('readProducerSession', () => {
  it('es null sin sesión previa y devuelve la sesión cuando existe', async () => {
    expect(await readProducerSession(depsWith().deps, PROJECT)).toBeNull();

    const session = {
      sessionId: '11111111-2222-3333-4444-555555555555',
      model: 'sonnet',
      createdAt: '2026-09-10T10:00:00.000Z',
      lastTurnAt: '2026-09-10T10:00:00.000Z',
    };
    const { deps } = depsWith([{ path: SESSION, contents: serializeMontageDocument(session) }]);
    expect(await readProducerSession(deps, PROJECT)).toEqual(session);
  });
});

describe('writeProducerConversation', () => {
  it('crea work/producer/ y escribe con el serializador del motor (2 espacios y newline final)', async () => {
    const { storage, deps } = depsWith();

    const relativePath = await writeProducerConversation(deps, PROJECT, { messages: [MESSAGE] });

    expect(relativePath).toBe('work/producer/conversation.json');
    expect(await storage.readTextFile(CONVERSATION)).toBe(
      serializeMontageDocument({ messages: [MESSAGE] }),
    );
    expect((await storage.stat('/media/demo-01/work/producer'))?.kind).toBe('directory');
  });

  it('deja el documento releíble por readProducerConversation', async () => {
    const { storage, deps } = depsWith();
    await writeProducerConversation(deps, PROJECT, { messages: [MESSAGE] });
    expect(await readProducerConversation(deps, PROJECT)).toEqual({ messages: [MESSAGE] });
    expect(storage).toBeDefined();
  });
});

describe('writeProducerSession', () => {
  it('persiste la sesión bajo work/producer/session.json', async () => {
    const { storage, deps } = depsWith();
    const session = {
      sessionId: '11111111-2222-3333-4444-555555555555',
      model: 'opus',
      createdAt: '2026-09-10T10:00:00.000Z',
      lastTurnAt: '2026-09-10T10:30:00.000Z',
    };

    expect(await writeProducerSession(deps, PROJECT, session)).toBe('work/producer/session.json');
    expect(JSON.parse(await storage.readTextFile(SESSION))).toEqual(session);
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
