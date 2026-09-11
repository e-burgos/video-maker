import { describe, expect, it } from 'vitest';

import {
  hasVoiceScriptTimeMarks,
  parseVoiceScriptLines,
  stripVoiceScriptTimeMarks,
} from './parse-voice-script-lines';

describe('parseVoiceScriptLines (FIX-e-burgos-009-002)', () => {
  it('lee una marca de inicio [m:ss] y deja la frase sin la marca', () => {
    expect(parseVoiceScriptLines('[0:20] Las campañas viven acá.')).toEqual([
      { text: 'Las campañas viven acá.', requestedStartMs: 20_000, requestedEndMs: null },
    ]);
  });

  it('lee minutos de dos dígitos y segundos con cero a la izquierda', () => {
    expect(parseVoiceScriptLines('[12:05] Frase')[0]).toEqual({
      text: 'Frase',
      requestedStartMs: 725_000,
      requestedEndMs: null,
    });
  });

  it.each([
    ['guion', '[1:30-1:37] Frase'],
    ['en dash', '[1:30–1:37] Frase'],
    ['em dash', '[1:30—1:37] Frase'],
    ['con espacios', '[ 1:30 - 1:37 ] Frase'],
  ])('lee un rango separado con %s', (_name, line) => {
    expect(parseVoiceScriptLines(line)[0]).toEqual({
      text: 'Frase',
      requestedStartMs: 90_000,
      requestedEndMs: 97_000,
    });
  });

  it('descarta un fin de rango que no es posterior al inicio', () => {
    expect(parseVoiceScriptLines('[1:30-1:30] Frase')[0]?.requestedEndMs).toBeNull();
  });

  it('deja sin marca la línea que no empieza con un corchete de tiempo', () => {
    expect(parseVoiceScriptLines('Entramos a la plataforma.')[0]).toEqual({
      text: 'Entramos a la plataforma.',
      requestedStartMs: null,
      requestedEndMs: null,
    });
  });

  it('no confunde un corchete que no es una marca de tiempo', () => {
    expect(parseVoiceScriptLines('[nota] Frase')[0]).toEqual({
      text: '[nota] Frase',
      requestedStartMs: null,
      requestedEndMs: null,
    });
  });

  it('mezcla líneas con marca y sin marca conservando el orden', () => {
    const lines = parseVoiceScriptLines('[0:00] Uno\nDos\n\n[0:20-0:28] Tres\n');

    expect(lines.map((line) => [line.text, line.requestedStartMs, line.requestedEndMs])).toEqual([
      ['Uno', 0, null],
      ['Dos', null, null],
      ['Tres', 20_000, 28_000],
    ]);
  });

  it('hasVoiceScriptTimeMarks distingue un guion cronometrado de uno encadenado', () => {
    expect(hasVoiceScriptTimeMarks(parseVoiceScriptLines('Uno\nDos'))).toBe(false);
    expect(hasVoiceScriptTimeMarks(parseVoiceScriptLines('Uno\n[0:20] Dos'))).toBe(true);
  });
});

describe('stripVoiceScriptTimeMarks (FIX-e-burgos-009-002)', () => {
  it('saca las marcas para que la alineación de captions no las lea como palabras', () => {
    expect(stripVoiceScriptTimeMarks('[0:00] Entramos.\n[0:20-0:28] Las campañas.')).toBe(
      'Entramos.\nLas campañas.',
    );
  });

  it('deja intacto un guion sin marcas', () => {
    expect(stripVoiceScriptTimeMarks('Entramos.\nLas campañas.')).toBe('Entramos.\nLas campañas.');
  });
});
