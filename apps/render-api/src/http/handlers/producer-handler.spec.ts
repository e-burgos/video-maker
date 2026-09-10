import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { isRenderApiError } from '../../errors/render-api-error';
import type { ProducerTurnResult, ProducerTurnStart } from '../../producer/producer-agent';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleCancelProducerTurn,
  handleCreateProducerMessage,
  handleGetProducer,
  handleGetProducerTurn,
} from './producer-handler';
import type { ProducerConversationBody, ProducerTurnAcceptedBody } from './producer-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = '/media/demo-01';

const OK_RESULT: ProducerTurnResult = {
  exitCode: 0,
  canceled: false,
  timedOut: false,
  spawnFailed: false,
  stderr: '',
};

const ANSWER = 'Hay un A-roll.\n\n```suggestions\n["Dale", "Mostrame el material"]\n```';

const SEED: FakeObjectStorageSeed = {
  directories: [PROJECT_ROOT, `${PROJECT_ROOT}/raw`, `${PROJECT_ROOT}/raw/aroll`, `${PROJECT_ROOT}/work`],
  files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'video' }],
};

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function messageRequest(body: unknown) {
  return requestLine({
    method: 'POST',
    path: '/projects/demo-01/producer/messages',
    body: toChunks([JSON.stringify(body)]),
  });
}

interface ScenarioOptions {
  readonly lines?: readonly string[];
  readonly result?: ProducerTurnResult;
  readonly hold?: boolean;
  readonly overrides?: Partial<RenderApiDependencies>;
}

function scenario(options: ScenarioOptions = {}) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, SEED);
  const starts: ProducerTurnStart[] = [];
  let cancelCount = 0;
  let releaseTurn: (result: ProducerTurnResult) => void = () => undefined;

  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    producerAgent: (start, onLine) => {
      starts.push(start);
      for (const line of options.lines ?? []) {
        onLine(line);
      }
      const completed =
        options.hold === true
          ? new Promise<ProducerTurnResult>((resolve) => {
              releaseTurn = resolve;
            })
          : Promise.resolve(options.result ?? OK_RESULT);
      return {
        cancel: () => {
          cancelCount += 1;
          releaseTurn({ ...OK_RESULT, canceled: true, exitCode: null });
        },
        completed,
      };
    },
    ...options.overrides,
  });

  return {
    deps,
    storage,
    starts,
    runtime: createRenderApiRuntime(deps),
    cancels: () => cancelCount,
  };
}

function successStream(answer = ANSWER): readonly string[] {
  return [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 'session-abc' }),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Miro el material.' }] },
    }),
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

describe('handleCreateProducerMessage', () => {
  it('acepta el turno con 202 y las claves exactas del contrato', async () => {
    const { deps, runtime } = scenario({ lines: successStream() });

    const response = await handleCreateProducerMessage(
      deps,
      STORE,
      { slug: 'demo-01' },
      messageRequest({ text: 'Contame qué material hay' }),
      runtime,
    );

    expect(response.status).toBe(202);
    const body = response.body as ProducerTurnAcceptedBody;
    expect(Object.keys(body).sort()).toEqual(['slug', 'startedAt', 'status', 'turnId'].sort());
    expect(body).toMatchObject({ slug: 'demo-01', status: 'running' });
  });

  it('manda al agente el modelo que eligió el usuario y lo deja en session.json (FIX-e-burgos-015-001)', async () => {
    const { deps, runtime, starts, storage } = scenario({ lines: successStream() });

    const accepted = (
      await handleCreateProducerMessage(
        deps,
        STORE,
        { slug: 'demo-01' },
        messageRequest({ text: 'hola', model: 'haiku' }),
        runtime,
      )
    ).body as ProducerTurnAcceptedBody;
    await new Promise((resolve) => setImmediate(resolve));

    expect(starts[0]?.model).toBe('haiku');
    expect(runtime.producerTurns.get(accepted.turnId).model).toBe('haiku');

    const body = (await handleGetProducer(deps, STORE, { slug: 'demo-01' }, runtime))
      .body as ProducerConversationBody;
    expect(body.session?.model).toBe('haiku');
    expect(body.messages[1]?.model).toBe('haiku');
    const onDisk = JSON.parse(
      await storage.readTextFile(`${PROJECT_ROOT}/work/producer/session.json`),
    ) as { model: string };
    expect(onDisk.model).toBe('haiku');
  });

  it('sin model explícito sigue con el modelo de la sesión, y sin sesión con el default del servicio', async () => {
    const { deps, runtime, starts } = scenario({ lines: successStream() });

    await handleCreateProducerMessage(
      deps,
      STORE,
      { slug: 'demo-01' },
      messageRequest({ text: 'primero' }),
      runtime,
    );
    await new Promise((resolve) => setImmediate(resolve));

    await handleCreateProducerMessage(
      deps,
      STORE,
      { slug: 'demo-01' },
      messageRequest({ text: 'segundo', model: 'haiku' }),
      runtime,
    );
    await new Promise((resolve) => setImmediate(resolve));

    await handleCreateProducerMessage(
      deps,
      STORE,
      { slug: 'demo-01' },
      messageRequest({ text: 'tercero' }),
      runtime,
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(starts.map((start) => start.model)).toEqual(['sonnet', 'haiku', 'haiku']);
  });

  it('rechaza con PRODUCER_MODEL_INVALID un modelo fuera de la lista permitida', async () => {
    const { deps, runtime, starts } = scenario({ lines: successStream() });

    expect(
      await codeOf(
        handleCreateProducerMessage(
          deps,
          STORE,
          { slug: 'demo-01' },
          messageRequest({ text: 'hola', model: 'gpt-5' }),
          runtime,
        ),
      ),
    ).toBe('PRODUCER_MODEL_INVALID');
    expect(starts).toEqual([]);
    expect(runtime.producerTurns.activeFor('demo-01')).toBeNull();
  });

  it('no mete el turno en la cola de jobs: el contador de la cola no se mueve (US-15-003)', async () => {
    const { deps, runtime } = scenario({ lines: successStream(), hold: true });

    await handleCreateProducerMessage(
      deps,
      STORE,
      { slug: 'demo-01' },
      messageRequest({ text: 'hola' }),
      runtime,
    );

    expect(runtime.jobs.size()).toEqual({ running: 0, queued: 0 });
  });

  it('rechaza el segundo turno del mismo proyecto con PRODUCER_TURN_ACTIVE y no arranca otro proceso', async () => {
    const { deps, runtime, starts } = scenario({ lines: successStream(), hold: true });

    await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'uno' }), runtime);
    expect(
      await codeOf(
        handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'dos' }), runtime),
      ),
    ).toBe('PRODUCER_TURN_ACTIVE');

    expect(starts).toHaveLength(1);
  });

  it('rechaza el mensaje vacío, el body que no es JSON y el proyecto inexistente', async () => {
    const { deps, runtime } = scenario({ lines: successStream() });

    expect(
      await codeOf(
        handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: '   ' }), runtime),
      ),
    ).toBe('PRODUCER_MESSAGE_INVALID');

    expect(
      await codeOf(
        handleCreateProducerMessage(
          deps,
          STORE,
          { slug: 'demo-01' },
          requestLine({ method: 'POST', path: '/x', body: toChunks(['no json']) }),
          runtime,
        ),
      ),
    ).toBe('REQUEST_BODY_INVALID_JSON');

    expect(
      await codeOf(
        handleCreateProducerMessage(deps, STORE, { slug: 'otro' }, messageRequest({ text: 'hola' }), runtime),
      ),
    ).toBe('PROJECT_NOT_FOUND');

    expect(
      await codeOf(
        handleCreateProducerMessage(deps, STORE, { slug: 'No Valido' }, messageRequest({ text: 'hola' }), runtime),
      ),
    ).toBe('PROJECT_SLUG_INVALID');
  });

  it('devuelve 503 PRODUCER_UNAVAILABLE cuando la máquina no tiene Claude Code', async () => {
    const { deps, runtime } = scenario({
      lines: successStream(),
      overrides: { probeProducerBinary: async () => false },
    });

    expect(
      await codeOf(
        handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime),
      ),
    ).toBe('PRODUCER_UNAVAILABLE');
  });
});

describe('handleGetProducer', () => {
  it('devuelve la conversación vacía, sin sesión y sin turno activo para un proyecto virgen', async () => {
    const { deps, runtime } = scenario();

    const response = await handleGetProducer(deps, STORE, { slug: 'demo-01' }, runtime);
    const body = response.body as ProducerConversationBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ['activeTurn', 'messages', 'models', 'session', 'slug'].sort(),
    );
    expect(body).toEqual({
      slug: 'demo-01',
      messages: [],
      session: null,
      activeTurn: null,
      models: {
        default: 'sonnet',
        allowed: [
          { id: 'sonnet', label: 'Sonnet', description: 'Balanced · faster, cheaper' },
          { id: 'opus', label: 'Opus', description: 'Most capable · slower, costlier' },
          { id: 'haiku', label: 'Haiku', description: 'Fastest · lightest' },
        ],
      },
    });
  });

  it('devuelve los dos mensajes, la sesión y ningún turno activo cuando el turno cerró', async () => {
    const { deps, runtime } = scenario({ lines: successStream() });

    const accepted = (
      await handleCreateProducerMessage(
        deps,
        STORE,
        { slug: 'demo-01' },
        messageRequest({ text: 'hola' }),
        runtime,
      )
    ).body as ProducerTurnAcceptedBody;
    await new Promise((resolve) => setImmediate(resolve));

    const body = (await handleGetProducer(deps, STORE, { slug: 'demo-01' }, runtime))
      .body as ProducerConversationBody;

    expect(body.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(body.messages[1]?.suggestions).toEqual(['Dale', 'Mostrame el material']);
    expect(body.session).toMatchObject({ sessionId: 'session-abc', model: 'sonnet' });
    expect(body.activeTurn).toBeNull();
    expect(accepted.turnId).not.toBe('');
  });

  it('expone el turno en curso en activeTurn', async () => {
    const { deps, runtime } = scenario({ lines: successStream(), hold: true });

    const accepted = (
      await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime)
    ).body as ProducerTurnAcceptedBody;

    const body = (await handleGetProducer(deps, STORE, { slug: 'demo-01' }, runtime))
      .body as ProducerConversationBody;

    expect(body.activeTurn?.turnId).toBe(accepted.turnId);
    expect(body.activeTurn?.status).toBe('running');
  });
});

describe('handleGetProducerTurn', () => {
  it('devuelve el turno con las claves exactas del contrato y sus eventos', async () => {
    const { deps, runtime } = scenario({ lines: successStream() });

    const accepted = (
      await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime)
    ).body as ProducerTurnAcceptedBody;
    await new Promise((resolve) => setImmediate(resolve));

    const response = await handleGetProducerTurn({ slug: 'demo-01', turnId: accepted.turnId }, runtime);
    const body = response.body as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      [
        'assistantMessage',
        'error',
        'events',
        'finishedAt',
        'model',
        'slug',
        'startedAt',
        'status',
        'suggestions',
        'turnId',
      ].sort(),
    );
    expect(body.status).toBe('succeeded');
    expect(body.assistantMessage).toBe('Hay un A-roll.');
    expect(body.suggestions).toEqual(['Dale', 'Mostrame el material']);
    expect(body.events).toEqual([
      { type: 'status', status: 'started' },
      { type: 'text', text: 'Miro el material.' },
    ]);
  });

  it('es 404 para un turno inexistente y para el turno de OTRO proyecto', async () => {
    const { deps, runtime } = scenario({ lines: successStream(), hold: true });

    const accepted = (
      await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime)
    ).body as ProducerTurnAcceptedBody;

    expect(await codeOf(handleGetProducerTurn({ slug: 'demo-01', turnId: 'nope' }, runtime))).toBe(
      'PRODUCER_TURN_NOT_FOUND',
    );
    expect(await codeOf(handleGetProducerTurn({ slug: 'demo-espacio', turnId: accepted.turnId }, runtime))).toBe(
      'PRODUCER_TURN_NOT_FOUND',
    );
  });
});

describe('handleCancelProducerTurn', () => {
  it('mata el proceso hijo, responde 202 y deja el turno canceled', async () => {
    const { deps, runtime, cancels } = scenario({ lines: successStream(), hold: true });

    const accepted = (
      await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime)
    ).body as ProducerTurnAcceptedBody;

    const response = await handleCancelProducerTurn({ slug: 'demo-01', turnId: accepted.turnId }, runtime);
    expect(response.status).toBe(202);
    expect(cancels()).toBe(1);

    await new Promise((resolve) => setImmediate(resolve));
    const turn = (await handleGetProducerTurn({ slug: 'demo-01', turnId: accepted.turnId }, runtime)).body as Record<
      string,
      unknown
    >;
    expect(turn.status).toBe('canceled');
    expect(runtime.producerTurns.activeFor('demo-01')).toBeNull();
  });

  it('cancelar un turno ya terminado es 409 y uno inexistente es 404', async () => {
    const { deps, runtime } = scenario({ lines: successStream() });

    const accepted = (
      await handleCreateProducerMessage(deps, STORE, { slug: 'demo-01' }, messageRequest({ text: 'hola' }), runtime)
    ).body as ProducerTurnAcceptedBody;
    await new Promise((resolve) => setImmediate(resolve));

    expect(await codeOf(handleCancelProducerTurn({ slug: 'demo-01', turnId: accepted.turnId }, runtime))).toBe(
      'PRODUCER_TURN_NOT_CANCELABLE',
    );
    expect(await codeOf(handleCancelProducerTurn({ slug: 'demo-01', turnId: 'nope' }, runtime))).toBe(
      'PRODUCER_TURN_NOT_FOUND',
    );
  });
});
