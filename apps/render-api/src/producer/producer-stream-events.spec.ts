import { describe, expect, it } from 'vitest';

import { interpretProducerStreamLine, summarizeToolUse, toProjectRelative } from './producer-stream-events';

const PROJECT_ROOT = '/media/demo-01';

describe('summarizeToolUse', () => {
  it('resume un ffprobe con el binario y la ruta relativa al proyecto', () => {
    expect(
      summarizeToolUse(
        'Bash',
        { command: 'ffprobe -v error -show_streams /media/demo-01/raw/broll/lentes.mp4' },
        PROJECT_ROOT,
      ),
    ).toBe('ffprobe raw/broll/lentes.mp4');
  });

  it('reconoce un job encolado por la API y lo nombra por su kind', () => {
    const command =
      "curl -sS -X POST http://127.0.0.1:4399/projects/demo-01/jobs -H 'content-type: application/json' -d '{\"kind\":\"montage\",\"preset\":\"hardware\"}'";
    expect(summarizeToolUse('Bash', { command }, PROJECT_ROOT)).toBe('queued montage job');
  });

  it('cae a render cuando el POST a /jobs no declara kind, como el body vacío de EP-012', () => {
    expect(
      summarizeToolUse('Bash', { command: 'curl -X POST http://127.0.0.1:4399/projects/demo-01/jobs' }, PROJECT_ROOT),
    ).toBe('queued render job');
  });

  it('un GET de polling sobre el job NO dice que encoló nada: sólo el POST encola', () => {
    expect(
      summarizeToolUse('Bash', { command: 'curl -sS http://127.0.0.1:4399/jobs/abc-123' }, PROJECT_ROOT),
    ).toBe('curl http://127.0.0.1:4399/jobs/abc-123');
    expect(
      summarizeToolUse('Bash', { command: 'curl -sS http://127.0.0.1:4399/projects/demo-01/jobs' }, PROJECT_ROOT),
    ).toBe('curl http://127.0.0.1:4399/projects/demo-01/jobs');
  });

  it('saca las comillas del comando: el agente cita las rutas con espacios y ensucia el resumen', () => {
    expect(
      summarizeToolUse('Bash', { command: 'ffprobe -v error "/media/demo-01/raw/broll/lentes.mp4"' }, PROJECT_ROOT),
    ).toBe('ffprobe raw/broll/lentes.mp4');
  });

  it('resume las herramientas de archivo por su ruta y las de búsqueda por su patrón', () => {
    expect(summarizeToolUse('Write', { file_path: '/media/demo-01/work/producer/script.txt' }, PROJECT_ROOT)).toBe(
      'Write work/producer/script.txt',
    );
    expect(summarizeToolUse('Glob', { pattern: 'raw/**/*.mp4' }, PROJECT_ROOT)).toBe('Glob raw/**/*.mp4');
  });

  it('devuelve el nombre pelado cuando el input no dice nada útil', () => {
    expect(summarizeToolUse('TodoWrite', { todos: [] }, PROJECT_ROOT)).toBe('TodoWrite');
    expect(summarizeToolUse('Bash', 'no-object', PROJECT_ROOT)).toBe('Bash');
  });

  it('deja el comando sin rutas tal cual y lo trunca cuando es larguísimo', () => {
    expect(summarizeToolUse('Bash', { command: 'ls -la' }, PROJECT_ROOT)).toBe('ls -la');
    const long = `echo ${'x'.repeat(400)}`;
    expect(summarizeToolUse('Bash', { command: long }, PROJECT_ROOT)).toHaveLength(140);
  });

  it('no acorta una ruta de otro proyecto ni el propio projectRoot', () => {
    expect(toProjectRelative('/media/otro/raw/a.mp4', PROJECT_ROOT)).toBe('/media/otro/raw/a.mp4');
    expect(toProjectRelative(PROJECT_ROOT, PROJECT_ROOT)).toBe(PROJECT_ROOT);
  });
});

describe('interpretProducerStreamLine', () => {
  it('toma el sessionId del init del sistema y abre el turno con un status', () => {
    expect(
      interpretProducerStreamLine(
        { type: 'system', subtype: 'init', session_id: 'abc-123' },
        PROJECT_ROOT,
      ),
    ).toEqual({ kind: 'session', sessionId: 'abc-123', events: [{ type: 'status', status: 'started' }] });
  });

  it('ignora los hooks del sistema y los eventos de cuota', () => {
    expect(interpretProducerStreamLine({ type: 'system', subtype: 'hook_started' }, PROJECT_ROOT).kind).toBe(
      'ignored',
    );
    expect(interpretProducerStreamLine({ type: 'rate_limit_event' }, PROJECT_ROOT).kind).toBe('ignored');
    expect(interpretProducerStreamLine('no es objeto', PROJECT_ROOT).kind).toBe('ignored');
  });

  it('convierte texto y tool_use del asistente, y descarta el thinking', () => {
    expect(
      interpretProducerStreamLine(
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'thinking', thinking: 'lo que piensa no se muestra' },
              { type: 'text', text: 'Miro el material.' },
              { type: 'tool_use', name: 'Bash', input: { command: 'ffprobe /media/demo-01/raw/aroll/clip01.mp4' } },
            ],
          },
        },
        PROJECT_ROOT,
      ),
    ).toEqual({
      kind: 'events',
      events: [
        { type: 'text', text: 'Miro el material.' },
        { type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' },
      ],
    });
  });

  it('descarta el texto en blanco del asistente', () => {
    expect(
      interpretProducerStreamLine(
        { type: 'assistant', message: { content: [{ type: 'text', text: '  \n ' }] } },
        PROJECT_ROOT,
      ).kind,
    ).toBe('ignored');
  });

  it('marca el fallo de una herramienta y calla los resultados exitosos', () => {
    expect(
      interpretProducerStreamLine(
        { type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'denied' }] } },
        PROJECT_ROOT,
      ),
    ).toEqual({ kind: 'events', events: [{ type: 'status', status: 'tool-failed' }] });

    expect(
      interpretProducerStreamLine(
        { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
        PROJECT_ROOT,
      ).kind,
    ).toBe('ignored');
  });

  it('cierra con el resultado, y sólo subtype success con is_error false es ok', () => {
    expect(
      interpretProducerStreamLine(
        { type: 'result', subtype: 'success', is_error: false, result: 'listo' },
        PROJECT_ROOT,
      ),
    ).toEqual({ kind: 'result', ok: true, text: 'listo', rateLimited: false });

    expect(
      interpretProducerStreamLine(
        { type: 'result', subtype: 'error_max_turns', is_error: true, result: 'se pasó de turnos' },
        PROJECT_ROOT,
      ),
    ).toEqual({ kind: 'result', ok: false, text: 'se pasó de turnos', rateLimited: false });
  });

  it('detecta el 429 de la suscripción en el subtype o en el texto del resultado', () => {
    expect(
      interpretProducerStreamLine(
        { type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Claude usage limit reached' },
        PROJECT_ROOT,
      ).kind === 'result',
    ).toBe(true);

    const signal = interpretProducerStreamLine(
      { type: 'result', subtype: 'error_during_execution', is_error: true, result: 'Claude usage limit reached' },
      PROJECT_ROOT,
    );
    expect(signal).toEqual({
      kind: 'result',
      ok: false,
      text: 'Claude usage limit reached',
      rateLimited: true,
    });
  });
});
