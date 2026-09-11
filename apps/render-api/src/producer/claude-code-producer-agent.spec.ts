import { describe, expect, it } from 'vitest';

import {
  createFakeProducerSpawner,
  createManualTimeouts,
  producerTurnStartFixture,
} from '../__fixtures__/fake-producer-agent';
import { readProducerConfig } from '../config/producer-config';
import { producerAllowedTools } from './build-producer-system-prompt';
import {
  createClaudeCodeProducerAgent,
  PRODUCER_KILL_GRACE_MS,
  PRODUCER_STDERR_MAX_CHARS,
  producerCliArgs,
} from './claude-code-producer-agent';

const CONFIG = readProducerConfig({}, '/repo', 'http://127.0.0.1:4310');

function agentWith(config = CONFIG) {
  const spawner = createFakeProducerSpawner();
  const timeouts = createManualTimeouts();
  const lines: string[] = [];
  const agent = createClaudeCodeProducerAgent(spawner.spawn, config, timeouts.schedule);
  return { spawner, timeouts, lines, agent };
}

describe('producerCliArgs', () => {
  it('pide stream-json verboso, dontAsk, el modelo configurado y la sesión nueva', () => {
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
      '--append-system-prompt',
      '# Skill: video-producer',
      '--add-dir',
      '/media/demo-01',
      '--session-id',
      '11111111-2222-3333-4444-555555555555',
      '--allowedTools',
      ...producerAllowedTools(null),
    ]);
  });

  it('no pide --include-partial-messages: el turno se pollea por mensaje, no por chunk', () => {
    expect(producerCliArgs(producerTurnStartFixture())).not.toContain(
      '--include-partial-messages',
    );
  });

  it('retoma el hilo con --resume en vez de --session-id a partir del segundo turno', () => {
    const args = producerCliArgs(producerTurnStartFixture({ resume: true }));
    expect(args).toContain('--resume');
    expect(args).not.toContain('--session-id');
  });

  it('pasa la lista blanca del turno, con el binario de Piper cuando está resuelto (FIX-e-burgos-015-002)', () => {
    const args = producerCliArgs(
      producerTurnStartFixture({ allowedTools: producerAllowedTools('/usr/bin/piper') }),
    );

    expect(args.at(-1)).toBe('Bash(/usr/bin/piper *)');
    expect(args.slice(args.indexOf('--allowedTools') + 1)).toEqual([
      ...producerAllowedTools('/usr/bin/piper'),
    ]);
  });

  it('pone --allowedTools ÚLTIMO y cada patrón como argumento propio: es variádico y se comería --resume', () => {
    const args = producerCliArgs(producerTurnStartFixture({ resume: true }));
    const index = args.indexOf('--allowedTools');

    expect(args.slice(index + 1)).toEqual([...producerAllowedTools(null)]);
    expect(args.slice(0, index)).toContain('--resume');
    expect(args.at(-1)).toBe(producerAllowedTools(null).at(-1));
  });

  it('no ofrece mkdir ni cp: el CLI nunca autoriza un comando de escritura por patrón comodín', () => {
    const patterns = [...producerAllowedTools(null)];
    expect(patterns).not.toContain('Bash(mkdir *)');
    expect(patterns).not.toContain('Bash(cp *)');
    expect(patterns).toContain('Write');
  });

  it('pasa el modelo del turno, no el del arranque del servicio', () => {
    const args = producerCliArgs(producerTurnStartFixture({ model: 'haiku', resume: true }));
    expect(args[args.indexOf('--model') + 1]).toBe('haiku');
    expect(args).toContain('--resume');
  });
});

describe('createClaudeCodeProducerAgent', () => {
  it('arranca el binario configurado en la raíz del repo, que es lo que pnpm nx necesita', () => {
    const { spawner, agent, lines } = agentWith();

    agent(producerTurnStartFixture(), (line) => lines.push(line));

    expect(spawner.last().input.command).toBe('claude');
    expect(spawner.last().input.cwd).toBe('/repo');
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

    timeouts.fire(1_800_000);
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
