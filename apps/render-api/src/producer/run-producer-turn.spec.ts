import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { readProducerConfig } from '../config/producer-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { isRenderApiError } from '../errors/render-api-error';
import type { ProducerTurnResult, ProducerTurnStart } from './producer-agent';
import { createProducerTurnRegistry } from './producer-turn-registry';
import { assertProducerMessageText, startProducerTurn } from './run-producer-turn';

const PROJECT = resolveMediaProject('/media/demo-01');
const CONFIG = readProducerConfig({}, '/repo', 'http://127.0.0.1:4399');

const OK_RESULT: ProducerTurnResult = {
  exitCode: 0,
  canceled: false,
  timedOut: false,
  spawnFailed: false,
  stderr: '',
};

const ANSWER = 'Tenés un A-roll de 26 s.\n\n```suggestions\n["Dale", "Cambiá el guion"]\n```';

interface ScriptedAgent {
  readonly lines: readonly string[];
  readonly result?: ProducerTurnResult;
}

function scenario(script: ScriptedAgent, overrides?: Partial<RenderApiDependencies>) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [
      '/media/demo-01',
      '/media/demo-01/raw',
      '/media/demo-01/raw/aroll',
      '/media/demo-01/work',
    ],
    files: [{ path: '/media/demo-01/raw/aroll/clip01.mp4', contents: 'video' }],
  });
  const starts: ProducerTurnStart[] = [];
  const cancels: string[] = [];
  let counter = 0;

  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    randomId: () => {
      counter += 1;
      return `id-${String(counter).padStart(2, '0')}`;
    },
    producerAgent: (start, onLine) => {
      starts.push(start);
      for (const line of script.lines) {
        onLine(line);
      }
      return {
        cancel: () => cancels.push('cancel'),
        completed: Promise.resolve(script.result ?? OK_RESULT),
      };
    },
    ...overrides,
  });

  return { callLog, storage, deps, starts, cancels, registry: createProducerTurnRegistry() };
}

function streamOf(answer: string, sessionId = 'session-abc'): readonly string[] {
  return [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }),
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Miro el material.' },
          {
            type: 'tool_use',
            name: 'Bash',
            input: { command: 'ffprobe /media/demo-01/raw/aroll/clip01.mp4' },
          },
        ],
      },
    }),
    'no es json y no debe romper el turno',
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: answer }),
  ];
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('assertProducerMessageText', () => {
  it('exige texto y devuelve el mensaje sin espacios de borde', () => {
    expect(assertProducerMessageText('  hola  ')).toBe('hola');
    expect(() => assertProducerMessageText('   ')).toThrow();
    expect(() => assertProducerMessageText(7)).toThrow();
  });
});

describe('startProducerTurn', () => {
  it('persiste el mensaje del usuario ANTES de responder, para que el chat lo muestre ya', async () => {
    const { deps, registry, storage } = scenario({ lines: streamOf(ANSWER) });

    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });

    const persisted = JSON.parse(await storage.readTextFile('/media/demo-01/work/producer/conversation.json'));
    expect(persisted.messages).toHaveLength(1);
    expect(persisted.messages[0]).toMatchObject({ role: 'user', text: 'hola', turnId: started.turnId });
    expect(registry.get(started.turnId).status).toBe('running');

    await started.completed;
  });

  it('abre sesión nueva en el primer turno y la retoma en el segundo', async () => {
    const first = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(first.deps, first.registry, {
      project: PROJECT,
      text: 'hola',
      config: CONFIG,
    });
    await started.completed;

    expect(first.starts[0]?.resume).toBe(false);
    const session = JSON.parse(await first.storage.readTextFile('/media/demo-01/work/producer/session.json'));
    expect(session).toMatchObject({ sessionId: 'session-abc', model: 'sonnet' });
    expect(first.starts[0]?.sessionId).not.toBe('session-abc');

    const second = scenario({ lines: streamOf(ANSWER) }, { storage: first.storage });
    const startedAgain = await startProducerTurn(second.deps, second.registry, {
      project: PROJECT,
      text: 'seguí',
      config: CONFIG,
    });
    await startedAgain.completed;

    expect(second.starts[0]?.resume).toBe(true);
    expect(second.starts[0]?.sessionId).toBe(session.sessionId);
  });

  it('persiste el sessionId que reporta el CLI, no el uuid que le pasamos, y cae al nuestro sin init', async () => {
    const { deps, registry, storage } = scenario({
      lines: [
        JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'listo' }),
      ],
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const session = JSON.parse(await storage.readTextFile('/media/demo-01/work/producer/session.json'));
    expect(session.sessionId).toBe('id-03');
  });

  it('acumula los eventos legibles del stream y descarta la línea que no es JSON', async () => {
    const { deps, registry } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId).events).toEqual([
      { type: 'status', status: 'started' },
      { type: 'text', text: 'Miro el material.' },
      { type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' },
    ]);
  });

  it('cierra con la respuesta sin el bloque de sugerencias y con las sugerencias aparte', async () => {
    const { deps, registry, storage } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const record = registry.get(started.turnId);
    expect(record.status).toBe('succeeded');
    expect(record.assistantMessage).toBe('Tenés un A-roll de 26 s.');
    expect(record.suggestions).toEqual(['Dale', 'Cambiá el guion']);

    const persisted = JSON.parse(await storage.readTextFile('/media/demo-01/work/producer/conversation.json'));
    expect(persisted.messages).toHaveLength(2);
    expect(persisted.messages[1]).toMatchObject({
      role: 'assistant',
      text: 'Tenés un A-roll de 26 s.',
      suggestions: ['Dale', 'Cambiá el guion'],
    });
    expect(await storage.readTextFile('/media/demo-01/work/producer/conversation.md')).toContain(
      '- Productor: Tenés un A-roll de 26 s.',
    );
  });

  it('guarda el jsonl crudo del turno, línea por línea, incluida la que no parsea', async () => {
    const lines = streamOf(ANSWER);
    const { deps, registry, storage } = scenario({ lines });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const raw = await storage.readTextFile(`/media/demo-01/work/producer/turns/${started.turnId}.jsonl`);
    expect(raw).toBe(`${lines.join('\n')}\n`);
  });

  it('un turno cancelado queda canceled, sin error y sin mensaje del asistente', async () => {
    const { deps, registry, storage } = scenario({
      lines: [JSON.stringify({ type: 'system', subtype: 'init', session_id: 's' })],
      result: { ...OK_RESULT, canceled: true, exitCode: null },
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId)).toMatchObject({
      status: 'canceled',
      error: null,
      assistantMessage: null,
    });
    const persisted = JSON.parse(await storage.readTextFile('/media/demo-01/work/producer/conversation.json'));
    expect(persisted.messages).toHaveLength(1);
    expect((await storage.stat('/media/demo-01/work/producer/session.json'))).toBeNull();
  });

  it('el 429 de la suscripción cierra el turno como failed con PRODUCER_RATE_LIMITED', async () => {
    const { deps, registry } = scenario({
      lines: [
        JSON.stringify({
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          result: 'Claude usage limit reached',
        }),
      ],
      result: { ...OK_RESULT, exitCode: 1 },
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId).error?.code).toBe('PRODUCER_RATE_LIMITED');
  });

  it('un fallo escribiendo la conversación cierra el turno como failed en vez de quedar colgado', async () => {
    const { deps, registry, storage } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    storage.control.queueReadTextFileError(
      '/media/demo-01/work/producer/conversation.json',
      Object.assign(new Error('EIO'), { code: 'EIO' }),
    );
    await started.completed;

    expect(registry.get(started.turnId).status).toBe('failed');
  });

  it('rechaza el turno con PRODUCER_UNAVAILABLE si falta la skill o el binario, sin reservar el proyecto', async () => {
    const withoutSkill = scenario({ lines: [] }, { readSkillDocument: async () => null });
    expect(
      await codeOf(
        startProducerTurn(withoutSkill.deps, withoutSkill.registry, {
          project: PROJECT,
          text: 'hola',
          config: CONFIG,
        }),
      ),
    ).toBe('PRODUCER_UNAVAILABLE');
    expect(withoutSkill.registry.activeFor('demo-01')).toBeNull();

    const withoutBinary = scenario({ lines: [] }, { probeProducerBinary: async () => false });
    expect(
      await codeOf(
        startProducerTurn(withoutBinary.deps, withoutBinary.registry, {
          project: PROJECT,
          text: 'hola',
          config: CONFIG,
        }),
      ),
    ).toBe('PRODUCER_UNAVAILABLE');
  });

  it('el segundo turno del mismo proyecto rebota con PRODUCER_TURN_ACTIVE', async () => {
    const { deps, registry } = scenario({ lines: [] });

    registry.reserve('demo-01', 'turn-en-curso', '2026-09-10T10:00:00.000Z');
    expect(
      await codeOf(startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG })),
    ).toBe('PRODUCER_TURN_ACTIVE');
  });

  it('pasa al agente la ruta absoluta del proyecto y el prompt con la skill y las reglas', async () => {
    const { deps, registry, starts } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(starts[0]?.projectRoot).toBe('/media/demo-01');
    expect(starts[0]?.systemPrompt).toContain('Sos el productor de video del studio.');
    expect(starts[0]?.systemPrompt).toContain('# This project');
    expect(starts[0]?.systemPrompt).toContain('http://127.0.0.1:4399/projects/demo-01/jobs');
  });
});
