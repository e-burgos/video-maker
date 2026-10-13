import { describe, expect, it } from 'vitest';

import {
  createFakeProducerSpawner,
  createManualTimeouts,
  producerTurnStartFixture,
} from '../__fixtures__/fake-producer-agent';
import { readProducerConfig } from '../config/producer-config';
import {
  createClaudeCodeProducerAgent,
  PRODUCER_KILL_GRACE_MS,
  PRODUCER_STDERR_MAX_CHARS,
  producerCliArgs,
} from './claude-code-producer-agent';

const CONFIG = readProducerConfig({}, '/repo', 'http://127.0.0.1:4310', '/tmp');

function agentWith(config = CONFIG) {
  const spawner = createFakeProducerSpawner();
  const timeouts = createManualTimeouts();
  const lines: string[] = [];
  const agent = createClaudeCodeProducerAgent(spawner.spawn, config, timeouts.schedule);
  return { spawner, timeouts, lines, agent };
}

describe('producerCliArgs', () => {
  it('pide stream-json verboso, dontAsk, el modelo configurado y la sesión nueva, sin tools built-in', () => {
    const args = producerCliArgs(producerTurnStartFixture());

    expect(args).toEqual([
      '--print',
      'Contame qué material hay',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'dontAsk',
      '--model',
      'sonnet',
      '--tools',
      '',
      '--setting-sources',
      '',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{"studio":{"command":"node","args":[],"env":{}}}}',
      '--allowedTools',
      'mcp__studio',
      '--append-system-prompt',
      '# Skill: video-producer',
      '--session-id',
      '11111111-2222-3333-4444-555555555555',
    ]);
  });

  it('no pide --include-partial-messages: el turno se pollea por mensaje, no por chunk', () => {
    expect(producerCliArgs(producerTurnStartFixture())).not.toContain(
      '--include-partial-messages',
    );
  });

  it('nunca pide --add-dir: el agente ya no lee archivos por su cuenta', () => {
    expect(producerCliArgs(producerTurnStartFixture())).not.toContain('--add-dir');
  });

  it('retoma el hilo con --resume en vez de --session-id a partir del segundo turno', () => {
    const args = producerCliArgs(producerTurnStartFixture({ resume: true }));
    expect(args).toContain('--resume');
    expect(args).not.toContain('--session-id');
  });

  it('aísla el turno de los settings, plugins y hooks del usuario pero conserva la sesión para --resume', () => {
    const args = producerCliArgs(producerTurnStartFixture());

    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(args).not.toContain('--no-session-persistence');
  });

  it('pasa el config MCP del turno tal cual, después de --strict-mcp-config', () => {
    const args = producerCliArgs(
      producerTurnStartFixture({ mcpConfig: '{"mcpServers":{"studio":{"command":"/usr/bin/node"}}}' }),
    );

    const index = args.indexOf('--mcp-config');
    expect(args[index + 1]).toBe('{"mcpServers":{"studio":{"command":"/usr/bin/node"}}}');
    expect(args[index - 1]).toBe('--strict-mcp-config');
  });

  it('sólo permite mcp__studio: nunca ningún tool built-in', () => {
    const args = producerCliArgs(producerTurnStartFixture());
    expect(args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--allowedTools') + 2)).toEqual([
      'mcp__studio',
    ]);
    const toolsIndex = args.indexOf('--tools');
    expect(args[toolsIndex + 1]).toBe('');
  });

  it('pasa el modelo del turno, no el del arranque del servicio', () => {
    const args = producerCliArgs(producerTurnStartFixture({ model: 'haiku', resume: true }));
    expect(args[args.indexOf('--model') + 1]).toBe('haiku');
    expect(args).toContain('--resume');
  });
});

describe('createClaudeCodeProducerAgent', () => {
  it('arranca el binario configurado en el cwd neutro del turno, no en la raíz del repo', () => {
    const { spawner, agent, lines } = agentWith();

    agent(producerTurnStartFixture(), (line) => lines.push(line));

    expect(spawner.last().input.command).toBe('claude');
    expect(spawner.last().input.cwd).toBe('/tmp/video-maker-producer/demo-01');
  });

  it('usa el cwd que trae cada turno, no uno fijo del arranque del servicio', () => {
    const { spawner, agent, lines } = agentWith();

    agent(producerTurnStartFixture({ cwd: '/tmp/video-maker-producer/otro-proyecto' }), (line) =>
      lines.push(line),
    );

    expect(spawner.last().input.cwd).toBe('/tmp/video-maker-producer/otro-proyecto');
  });

  it('entrega una línea por evento, aunque el chunk parta un JSON al medio', async () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().emitStdout('{"type":"system"}\n{"type":"assis');
    spawner.last().emitStdout('tant"}\n');
    spawner.last().exit(0);
    await run.completed;

    expect(lines).toEqual(['{"type":"system"}', '{"type":"assistant"}']);
  });

  it('emite la última línea sin newline final y descarta las líneas vacías', async () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().emitStdout('{"a":1}\r\n\n{"b":2}');
    spawner.last().exit(0);
    await run.completed;

    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('devuelve el exit code y el stderr acotado del proceso', async () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().emitStderr('x'.repeat(PRODUCER_STDERR_MAX_CHARS + 500));
    spawner.last().exit(1);

    const result = await run.completed;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toHaveLength(PRODUCER_STDERR_MAX_CHARS);
    expect(result).toMatchObject({ canceled: false, timedOut: false, spawnFailed: false });
  });

  it('marca spawnFailed cuando el binario no existe, sin esperar un exit que no llega', async () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().emitSpawnError(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }));

    const result = await run.completed;
    expect(result).toMatchObject({ spawnFailed: true, exitCode: null });
  });

  it('cancelar manda SIGTERM y escala a SIGKILL si el hijo no se muere', async () => {
    const { spawner, timeouts, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    run.cancel();
    expect(spawner.last().signals()).toEqual(['SIGTERM']);

    timeouts.fire(PRODUCER_KILL_GRACE_MS);
    expect(spawner.last().signals()).toEqual(['SIGTERM', 'SIGKILL']);

    spawner.last().exit(null, 'SIGKILL');
    expect(await run.completed).toMatchObject({ canceled: true, exitCode: null });
  });

  it('cancelar dos veces no manda dos SIGTERM', () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    run.cancel();
    run.cancel();

    expect(spawner.last().signals()).toEqual(['SIGTERM']);
  });

  it('el timeout del turno mata el proceso y lo marca timedOut, no canceled', async () => {
    const { spawner, timeouts, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    timeouts.fire(3_600_000);
    expect(spawner.last().signals()).toEqual(['SIGTERM']);

    spawner.last().exit(null, 'SIGTERM');
    expect(await run.completed).toMatchObject({ timedOut: true, canceled: false });
  });

  it('cancela el timeout del turno al terminar, para no matar un proceso ajeno', async () => {
    const { spawner, timeouts, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().exit(0);
    await run.completed;

    expect(timeouts.pending()).toEqual([]);
  });

  it('un exit tardío después de cancelar no vuelve a resolver el turno', async () => {
    const { spawner, agent, lines } = agentWith();
    const run = agent(producerTurnStartFixture(), (line) => lines.push(line));

    spawner.last().exit(0);
    const first = await run.completed;
    spawner.last().exit(137);

    expect(await run.completed).toBe(first);
    run.cancel();
    expect(spawner.last().signals()).toEqual([]);
  });
});
