import { describe, expect, it } from 'vitest';

import { interpretProducerStreamLine, summarizeToolUse } from './producer-stream-events';

describe('summarizeToolUse', () => {
  it('describes reading the reference analyses', () => {
    expect(summarizeToolUse('mcp__studio__get_reference_brief', {})).toBe('Listing the analysed references');
    expect(summarizeToolUse('mcp__studio__get_reference_brief', { name: 'modelo' })).toBe(
      'Reading the analysis of modelo',
    );
  });

  it('mide un archivo con probe_media', () => {
    expect(summarizeToolUse('mcp__studio__probe_media', { path: 'raw/broll/lentes.mp4' })).toBe(
      'Measuring raw/broll/lentes.mp4',
    );
  });

  it('cuenta y pluraliza los frames de extract_frames', () => {
    expect(
      summarizeToolUse('mcp__studio__extract_frames', { path: 'raw/aroll/a.mp4', atSeconds: [1, 5, 9] }),
    ).toBe('Looking at 3 frames of raw/aroll/a.mp4');
    expect(
      summarizeToolUse('mcp__studio__extract_frames', { path: 'raw/aroll/a.mp4', atSeconds: [1] }),
    ).toBe('Looking at 1 frame of raw/aroll/a.mp4');
  });

  it('nombra el job que arranca por su kind', () => {
    expect(summarizeToolUse('mcp__studio__start_job', { job: { kind: 'montage' } })).toBe(
      'Starting the montage job',
    );
    expect(summarizeToolUse('mcp__studio__start_job', { job: { kind: 'photo-aroll' } })).toBe(
      'Starting the photo-aroll job',
    );
  });

  it('espera un job por su id', () => {
    expect(summarizeToolUse('mcp__studio__wait_for_job', { jobId: 'job-123', timeoutSeconds: 30 })).toBe(
      'Waiting for job job-123',
    );
  });

  it('busca música libre por el mood pedido', () => {
    expect(summarizeToolUse('mcp__studio__search_free_music', { mood: 'calm piano', maxResults: 5 })).toBe(
      'Searching free music: calm piano',
    );
  });

  it('copia un asset hacia su rol de destino', () => {
    expect(
      summarizeToolUse('mcp__studio__copy_asset', { from: 'raw/broll/x.mp4', role: 'aroll', filename: 'y.mp4' }),
    ).toBe('Copying raw/broll/x.mp4 into raw/aroll/');
  });

  it('resume las herramientas sin argumentos relevantes con una frase fija', () => {
    expect(summarizeToolUse('mcp__studio__get_project_overview', {})).toBe('Checking the project');
    expect(summarizeToolUse('mcp__studio__list_voices', {})).toBe('Listing available voices');
    expect(summarizeToolUse('mcp__studio__get_timeline', {})).toBe('Checking the timeline');
    expect(summarizeToolUse('mcp__studio__put_timeline', { timeline: {} })).toBe('Saving the timeline');
    expect(summarizeToolUse('mcp__studio__import_music', { resultId: 'r1' })).toBe('Importing music');
  });

  it('nombra las secciones que patch_timeline va a reemplazar', () => {
    expect(summarizeToolUse('mcp__studio__patch_timeline', { logo: {}, music: [] })).toBe(
      'Updating logo, music',
    );
    expect(summarizeToolUse('mcp__studio__patch_timeline', {})).toBe('Updating the timeline');
  });

  it('lee y escribe archivos de texto del proyecto por su ruta', () => {
    expect(summarizeToolUse('mcp__studio__read_project_text', { path: 'work/producer/script.txt' })).toBe(
      'Reading work/producer/script.txt',
    );
    expect(summarizeToolUse('mcp__studio__write_project_text', { path: 'work/credits.json', content: '{}' })).toBe(
      'Writing work/credits.json',
    );
  });

  it('cancela un job por su id', () => {
    expect(summarizeToolUse('mcp__studio__cancel_job', { jobId: 'job-9' })).toBe('Canceling job job-9');
  });

  it('nunca expone una ruta absoluta del host: el contrato ya obliga rutas relativas al proyecto', () => {
    const summary = summarizeToolUse('mcp__studio__probe_media', { path: 'raw/aroll/a.mp4' });
    expect(summary).not.toContain('/media/');
    expect(summary).not.toContain('/Users/');
  });

  it('cae al nombre pelado de la herramienta cuando no es una del contrato mcp__studio__', () => {
    expect(summarizeToolUse('Bash', { command: 'ls -la' })).toBe('Bash');
    expect(summarizeToolUse('mcp__other__thing', {})).toBe('mcp__other__thing');
  });

  it('devuelve el nombre pelado cuando el input no es un objeto', () => {
    expect(summarizeToolUse('mcp__studio__probe_media', 'no-object')).toBe(
      'Measuring the media',
    );
  });
});

describe('interpretProducerStreamLine', () => {
  it('toma el sessionId del init del sistema y abre el turno con un status', () => {
    expect(
      interpretProducerStreamLine({ type: 'system', subtype: 'init', session_id: 'abc-123' }),
    ).toEqual({ kind: 'session', sessionId: 'abc-123', events: [{ type: 'status', status: 'started' }] });
  });

  it('ignora los hooks del sistema y los eventos de cuota', () => {
    expect(interpretProducerStreamLine({ type: 'system', subtype: 'hook_started' }).kind).toBe('ignored');
    expect(interpretProducerStreamLine({ type: 'rate_limit_event' }).kind).toBe('ignored');
    expect(interpretProducerStreamLine('no es objeto').kind).toBe('ignored');
  });

  it('convierte texto y tool_use del asistente, y descarta el thinking', () => {
    expect(
      interpretProducerStreamLine({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'lo que piensa no se muestra' },
            { type: 'text', text: 'Miro el material.' },
            {
              type: 'tool_use',
              name: 'mcp__studio__probe_media',
              input: { path: 'raw/aroll/clip01.mp4' },
            },
          ],
        },
      }),
    ).toEqual({
      kind: 'events',
      events: [
        { type: 'text', text: 'Miro el material.' },
        { type: 'tool', name: 'mcp__studio__probe_media', summary: 'Measuring raw/aroll/clip01.mp4' },
      ],
    });
  });

  it('descarta el texto en blanco del asistente', () => {
    expect(
      interpretProducerStreamLine({
        type: 'assistant',
        message: { content: [{ type: 'text', text: '  \n ' }] },
      }).kind,
    ).toBe('ignored');
  });

  it('marca el fallo de una herramienta y calla los resultados exitosos', () => {
    expect(
      interpretProducerStreamLine({
        type: 'user',
        message: { content: [{ type: 'tool_result', is_error: true, content: 'denied' }] },
      }),
    ).toEqual({ kind: 'events', events: [{ type: 'status', status: 'tool-failed' }] });

    expect(
      interpretProducerStreamLine({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'ok' }] },
      }).kind,
    ).toBe('ignored');
  });

  it('cierra con el resultado, y sólo subtype success con is_error false es ok', () => {
    expect(
      interpretProducerStreamLine({ type: 'result', subtype: 'success', is_error: false, result: 'listo' }),
    ).toEqual({ kind: 'result', ok: true, text: 'listo', rateLimited: false });

    expect(
      interpretProducerStreamLine({
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        result: 'se pasó de turnos',
      }),
    ).toEqual({ kind: 'result', ok: false, text: 'se pasó de turnos', rateLimited: false });
  });

  it('detecta el 429 de la suscripción en el subtype o en el texto del resultado', () => {
    const signal = interpretProducerStreamLine({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'Claude usage limit reached',
    });

    expect(signal).toEqual({
      kind: 'result',
      ok: false,
      text: 'Claude usage limit reached',
      rateLimited: true,
    });
  });
});
