import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { ProducerMessage } from './producer-documents';
import { appendProducerMessage } from './producer-store';
import { buildProducerHistory } from './producer-history';
import { createProducerTurnRegistry } from './producer-turn-registry';

const PROJECT = resolveMediaProject('/media/demo-01');

function fixture() {
  const callLog = createCallLog();
  const deps = createFakeRenderApiDependencies(callLog);
  deps.localStore.projects.insert('demo-01');
  const registry = createProducerTurnRegistry();
  return { deps, registry };
}

function userMessage(id: string, text: string, createdAt: string): ProducerMessage {
  return { id, role: 'user', text, createdAt };
}

function assistantMessage(id: string, text: string, createdAt: string, turnId?: string): ProducerMessage {
  return { id, role: 'assistant', text, createdAt, ...(turnId === undefined ? {} : { turnId }) };
}

describe('buildProducerHistory', () => {
  it('rebuilds a simple back-and-forth into role/content pairs in order', () => {
    const { deps, registry } = fixture();
    appendProducerMessage(deps, PROJECT, userMessage('u1', 'Hola', '2026-01-01T00:00:00.000Z'));
    appendProducerMessage(deps, PROJECT, assistantMessage('a1', 'Buenas', '2026-01-01T00:00:01.000Z'));
    appendProducerMessage(deps, PROJECT, userMessage('u2', 'Segunda', '2026-01-01T00:00:02.000Z'));
    appendProducerMessage(deps, PROJECT, assistantMessage('a2', 'Respuesta', '2026-01-01T00:00:03.000Z'));

    const history = buildProducerHistory(deps, PROJECT, registry);

    expect(history).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Buenas' },
      { role: 'user', content: 'Segunda' },
      { role: 'assistant', content: 'Respuesta' },
    ]);
  });

  it('keeps a trailing solo user message with no assistant reply yet', () => {
    const { deps, registry } = fixture();
    appendProducerMessage(deps, PROJECT, userMessage('u1', 'Hola', '2026-01-01T00:00:00.000Z'));
    appendProducerMessage(deps, PROJECT, assistantMessage('a1', 'Buenas', '2026-01-01T00:00:01.000Z'));
    appendProducerMessage(deps, PROJECT, userMessage('u2', 'Andando', '2026-01-01T00:00:02.000Z'));

    const history = buildProducerHistory(deps, PROJECT, registry);

    expect(history.at(-1)).toEqual({ role: 'user', content: 'Andando' });
  });

  it('prefixes an assistant message with a one-line tool summary when the turn is still in the registry', () => {
    const { deps, registry } = fixture();
    registry.reserve('demo-01', 'turn-1', '2026-01-01T00:00:00.000Z', 'sonnet');
    registry.appendEvents('turn-1', [
      { type: 'tool', name: 'mcp__studio__probe_media', summary: 'Measuring raw/aroll/a.mp4' },
      { type: 'tool', name: 'mcp__studio__start_job', summary: 'Starting the montage job' },
    ]);
    appendProducerMessage(deps, PROJECT, userMessage('u1', 'Armá el montaje', '2026-01-01T00:00:00.000Z'));
    appendProducerMessage(
      deps,
      PROJECT,
      assistantMessage('a1', 'Listo, arranqué el job.', '2026-01-01T00:00:01.000Z', 'turn-1'),
    );

    const history = buildProducerHistory(deps, PROJECT, registry);

    expect(history[1]).toEqual({
      role: 'assistant',
      content: '[Tools used: mcp__studio__probe_media, mcp__studio__start_job]\nListo, arranqué el job.',
    });
  });

  it('omits the tool summary when the turn is not in the registry (server restarted) or has no tool events', () => {
    const { deps, registry } = fixture();
    registry.reserve('demo-01', 'turn-2', '2026-01-01T00:00:00.000Z', 'sonnet');
    appendProducerMessage(deps, PROJECT, userMessage('u1', 'Hola', '2026-01-01T00:00:00.000Z'));
    appendProducerMessage(
      deps,
      PROJECT,
      assistantMessage('a1', 'Sin herramientas.', '2026-01-01T00:00:01.000Z', 'turn-2'),
    );
    appendProducerMessage(deps, PROJECT, userMessage('u2', 'De nuevo', '2026-01-01T00:00:02.000Z'));
    appendProducerMessage(
      deps,
      PROJECT,
      assistantMessage('a2', 'Turno perdido.', '2026-01-01T00:00:03.000Z', 'turn-vanished'),
    );

    const history = buildProducerHistory(deps, PROJECT, registry);

    expect(history[1]).toEqual({ role: 'assistant', content: 'Sin herramientas.' });
    expect(history[3]).toEqual({ role: 'assistant', content: 'Turno perdido.' });
  });

  it('always keeps at least the most recent exchange even if it alone exceeds the budget', () => {
    const { deps, registry } = fixture();
    const longText = 'x'.repeat(500);
    appendProducerMessage(deps, PROJECT, userMessage('u1', longText, '2026-01-01T00:00:00.000Z'));
    appendProducerMessage(deps, PROJECT, assistantMessage('a1', longText, '2026-01-01T00:00:01.000Z'));

    const history = buildProducerHistory(deps, PROJECT, registry, { charBudget: 10 });

    expect(history).toEqual([
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
    ]);
  });

  it('collapses older exchanges beyond the budget into one leading context note, keeping the recent ones intact', () => {
    const { deps, registry } = fixture();
    for (let index = 0; index < 5; index += 1) {
      appendProducerMessage(
        deps,
        PROJECT,
        userMessage(`u${index}`, 'x'.repeat(100), `2026-01-01T00:0${index}:00.000Z`),
      );
      appendProducerMessage(
        deps,
        PROJECT,
        assistantMessage(`a${index}`, 'x'.repeat(100), `2026-01-01T00:0${index}:01.000Z`),
      );
    }

    const history = buildProducerHistory(deps, PROJECT, registry, { charBudget: 450 });

    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toContain('Context note');
    expect(history[0]?.content).toContain('earlier exchange');
    expect(history.at(-1)).toEqual({ role: 'assistant', content: 'x'.repeat(100) });
    expect(history.length).toBeLessThan(11);
  });

  it('returns an empty history for a project with no producer conversation yet', () => {
    const { deps, registry } = fixture();
    expect(buildProducerHistory(deps, PROJECT, registry)).toEqual([]);
  });
});
