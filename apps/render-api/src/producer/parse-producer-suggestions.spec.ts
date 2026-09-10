import { describe, expect, it } from 'vitest';

import { parseProducerAnswer } from './parse-producer-suggestions';

describe('parseProducerAnswer', () => {
  it('separa el texto del bloque de sugerencias y saca el bloque del mensaje', () => {
    const raw = [
      'Tenés un A-roll de 26 s y tres fotos.',
      '',
      '```suggestions',
      '["Proponé un guion de 30 s", "Buscá música libre", "Mostrame el inventario"]',
      '```',
      '',
    ].join('\n');

    expect(parseProducerAnswer(raw)).toEqual({
      text: 'Tenés un A-roll de 26 s y tres fotos.',
      suggestions: ['Proponé un guion de 30 s', 'Buscá música libre', 'Mostrame el inventario'],
    });
  });

  it('sin bloque devuelve el texto entero y ninguna sugerencia', () => {
    expect(parseProducerAnswer('  listo  ')).toEqual({ text: 'listo', suggestions: [] });
  });

  it('se queda con el último bloque cuando el modelo emitió más de uno', () => {
    const raw = '```suggestions\n["viejo"]\n```\ntexto\n```suggestions\n["nuevo"]\n```';
    expect(parseProducerAnswer(raw)).toEqual({ text: 'texto', suggestions: ['nuevo'] });
  });

  it('ignora un bloque que no es JSON o no es un array, sin perder el texto', () => {
    expect(parseProducerAnswer('hola\n```suggestions\nno json\n```')).toEqual({
      text: 'hola',
      suggestions: [],
    });
    expect(parseProducerAnswer('hola\n```suggestions\n{"a":1}\n```')).toEqual({
      text: 'hola',
      suggestions: [],
    });
  });

  it('descarta las entradas que no son strings, normaliza los espacios y corta en cuatro', () => {
    const raw = '```suggestions\n["  uno\\n  dos ", 7, "", "b", "c", "d", "e"]\n```';
    expect(parseProducerAnswer(raw).suggestions).toEqual(['uno dos', 'b', 'c', 'd']);
  });
});
