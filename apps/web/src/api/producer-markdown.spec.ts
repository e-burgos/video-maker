import { describe, expect, it } from 'vitest';

import {
  inlinesToPlainText,
  numberedOptions,
  parseInlines,
  parseProducerMarkdown,
} from './producer-markdown';

describe('parseInlines', () => {
  it('splits a line into plain and bold runs', () => {
    expect(parseInlines('Tengo **3 clips** de a-roll')).toEqual([
      { kind: 'text', text: 'Tengo ' },
      { kind: 'bold', text: '3 clips' },
      { kind: 'text', text: ' de a-roll' },
    ]);
  });

  it('reads a line that is only bold', () => {
    expect(parseInlines('**listo**')).toEqual([{ kind: 'bold', text: 'listo' }]);
  });

  it('leaves an unbalanced marker as literal text', () => {
    expect(parseInlines('2 ** 3 = 8')).toEqual([{ kind: 'text', text: '2 ** 3 = 8' }]);
  });

  it('round trips to plain text', () => {
    expect(inlinesToPlainText(parseInlines('a **b** c'))).toBe('a b c');
  });
});

describe('parseProducerMarkdown', () => {
  it('joins the lines of a paragraph and breaks on a blank line', () => {
    expect(parseProducerMarkdown('una linea\ny la siguiente\n\notro parrafo')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'una linea y la siguiente' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'otro parrafo' }] },
    ]);
  });

  it('reads an unordered list with both markers', () => {
    const blocks = parseProducerMarkdown('- uno\n* dos');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('bullets');
    expect(blocks[0]?.kind === 'bullets' ? blocks[0].items.map(inlinesToPlainText) : []).toEqual([
      'uno',
      'dos',
    ]);
  });

  it('reads a numbered list with a dot and with a parenthesis', () => {
    const blocks = parseProducerMarkdown('1. treinta segundos\n2) cuarenta y cinco');

    expect(blocks[0]?.kind).toBe('numbers');
    expect(blocks[0]?.kind === 'numbers' ? blocks[0].items.map(inlinesToPlainText) : []).toEqual([
      'treinta segundos',
      'cuarenta y cinco',
    ]);
  });

  it('does not merge two lists of different kind into one block', () => {
    expect(parseProducerMarkdown('- uno\n1. dos').map((block) => block.kind)).toEqual([
      'bullets',
      'numbers',
    ]);
  });

  it('closes a list when a paragraph follows it without a blank line', () => {
    expect(parseProducerMarkdown('- uno\ncerramos').map((block) => block.kind)).toEqual([
      'bullets',
      'paragraph',
    ]);
  });

  it('keeps the bold runs inside a list item', () => {
    const blocks = parseProducerMarkdown('- **treinta** segundos');

    expect(blocks[0]?.kind === 'bullets' ? blocks[0].items[0] : []).toEqual([
      { kind: 'bold', text: 'treinta' },
      { kind: 'text', text: ' segundos' },
    ]);
  });

  it('returns no block for an empty message', () => {
    expect(parseProducerMarkdown('')).toEqual([]);
  });
});

describe('parseProducerMarkdown — the shapes the producer actually emits', () => {
  it('reads a markdown table with its header, instead of a wall of pipes', () => {
    const blocks = parseProducerMarkdown(
      '| Archivo | Duración |\n|---|---|\n| clip01.mp4 | 26 s |\n| lentes.mp4 | 20 s |',
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('table');
    if (blocks[0]?.kind !== 'table') {
      throw new Error('expected a table');
    }
    expect(blocks[0].header.map(inlinesToPlainText)).toEqual(['Archivo', 'Duración']);
    expect(blocks[0].rows.map((row) => row.map(inlinesToPlainText))).toEqual([
      ['clip01.mp4', '26 s'],
      ['lentes.mp4', '20 s'],
    ]);
  });

  it('accepts the separator with and without alignment colons and outer pipes', () => {
    expect(parseProducerMarkdown('a | b\n:--- | ---:\n1 | 2')[0]?.kind).toBe('table');
  });

  it('does not turn a paragraph with a pipe into a table', () => {
    expect(parseProducerMarkdown('el comando es a | b\ny sigue')[0]?.kind).toBe('paragraph');
  });

  it('closes the table when the rows stop', () => {
    expect(
      parseProducerMarkdown('| a |\n|---|\n| 1 |\ncerramos').map((block) => block.kind),
    ).toEqual(['table', 'paragraph']);
  });

  it('reads a fenced code block as one block and keeps its line breaks', () => {
    const blocks = parseProducerMarkdown('El guion:\n\n```\nlinea uno\nlinea dos\n```\nlisto');

    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'code', 'paragraph']);
    if (blocks[1]?.kind !== 'code') {
      throw new Error('expected a code block');
    }
    expect(blocks[1].text).toBe('linea uno\nlinea dos');
    expect(blocks[1].language).toBeNull();
  });

  it('keeps the language of a fenced block and never treats its content as markdown', () => {
    const blocks = parseProducerMarkdown('```bash\n- no es una lista\n| ni una tabla |\n```');

    expect(blocks).toHaveLength(1);
    if (blocks[0]?.kind !== 'code') {
      throw new Error('expected a code block');
    }
    expect(blocks[0].language).toBe('bash');
    expect(blocks[0].text).toBe('- no es una lista\n| ni una tabla |');
  });

  it('closes an unterminated fence at the end of the message', () => {
    const blocks = parseProducerMarkdown('```\nquedo abierto');

    expect(blocks[0]?.kind).toBe('code');
  });

  it('reads a horizontal rule instead of printing three dashes', () => {
    expect(parseProducerMarkdown('arriba\n\n---\n\nabajo').map((block) => block.kind)).toEqual([
      'paragraph',
      'rule',
      'paragraph',
    ]);
  });

  it('does not confuse a bullet with a rule', () => {
    expect(parseProducerMarkdown('- uno')[0]?.kind).toBe('bullets');
  });

  it('reads a heading and its level instead of printing the hashes', () => {
    const blocks = parseProducerMarkdown('## Inventario\n\ntexto');

    expect(blocks[0]).toEqual({
      kind: 'heading',
      level: 2,
      inlines: [{ kind: 'text', text: 'Inventario' }],
    });
    expect(blocks[1]?.kind).toBe('paragraph');
  });

  it('does not read a hash without a space as a heading', () => {
    expect(parseProducerMarkdown('#hashtag')[0]?.kind).toBe('paragraph');
  });

  it('reads inline code spans next to bold', () => {
    expect(parseInlines('usá `--seed 1` para **repetir**')).toEqual([
      { kind: 'text', text: 'usá ' },
      { kind: 'code', text: '--seed 1' },
      { kind: 'text', text: ' para ' },
      { kind: 'bold', text: 'repetir' },
    ]);
  });
});

describe('numberedOptions', () => {
  it('offers the numbered options of an answer as quick replies', () => {
    expect(
      numberedOptions('Te propongo:\n\n1. Un corte de 30 s.\n2. Un corte de 45 s con B-roll.'),
    ).toEqual(['Un corte de 30 s.', 'Un corte de 45 s con B-roll.']);
  });

  it('needs at least two options: a single numbered line is a step, not a choice', () => {
    expect(numberedOptions('1. Primero subí el material.')).toEqual([]);
  });

  it('drops an option that is a paragraph in disguise', () => {
    const long = 'x'.repeat(130);

    expect(numberedOptions(`1. corto\n2. ${long}`)).toEqual(['corto']);
  });

  it('ignores an unordered list', () => {
    expect(numberedOptions('- uno\n- dos')).toEqual([]);
  });
});
