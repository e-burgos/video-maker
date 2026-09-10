import { describe, expect, it } from 'vitest';

import { codeLayout, columnsThatFit } from './code-lines';

describe('codeLayout', () => {
  it('keeps a short snippet as written at the base font size', () => {
    const layout = codeLayout({ code: 'const a = 1;\nconst b = 2;', baseFontSize: 40 });

    expect(layout.lines).toEqual(['const a = 1;', 'const b = 2;']);
    expect(layout.fontSize).toBe(40);
    expect(layout.truncated).toBe(false);
  });

  it('normalizes CRLF and expands tabs so the render never shows a stray glyph', () => {
    const layout = codeLayout({ code: 'if (x) {\r\n\treturn 1;\r\n}', baseFontSize: 40 });

    expect(layout.lines).toEqual(['if (x) {', '  return 1;', '}']);
  });

  it('drops the trailing blank lines a generated snippet carries', () => {
    const layout = codeLayout({ code: 'const a = 1;\n\n\n', baseFontSize: 40 });

    expect(layout.lines).toEqual(['const a = 1;']);
  });

  it('shrinks the font when the snippet has more lines than fit and reports the truncation', () => {
    const code = Array.from({ length: 12 }, (_, index) => `line ${index}`).join('\n');
    const layout = codeLayout({ code, baseFontSize: 40, maxLines: 6 });

    expect(layout.lines).toHaveLength(6);
    expect(layout.fontSize).toBeLessThan(40);
    expect(layout.truncated).toBe(true);
  });

  it('no recorta una línea que ya entra al font reducido: primero achica, después recorta', () => {
    const layout = codeLayout({ code: 'E: Could not open lock file... Permission denied', baseFontSize: 40, maxColumns: 36 });

    expect(layout.fontSize).toBeLessThan(40);
    expect(layout.lines[0]).toBe('E: Could not open lock file... Permission denied');
    expect(layout.truncated).toBe(false);
  });

  it('clips a line that does not fit even at the smallest font, with an ellipsis', () => {
    const line = 'x'.repeat(200);
    const layout = codeLayout({ code: line, baseFontSize: 40, maxColumns: 10 });

    expect(layout.fontSize).toBe(Math.round(40 * 0.55));
    expect(layout.lines[0]).toHaveLength(Math.floor(10 / 0.55));
    expect(layout.lines[0]?.endsWith('…')).toBe(true);
    expect(layout.truncated).toBe(true);
  });

  it('never shrinks the font past the legibility floor', () => {
    const code = Array.from({ length: 400 }, (_, index) => `line ${index}`).join('\n');
    const layout = codeLayout({ code, baseFontSize: 40, maxLines: 4 });

    expect(layout.fontSize).toBe(Math.round(40 * 0.55));
  });

  it('mide cuántas columnas monoespaciadas entran en un ancho dado', () => {
    expect(columnsThatFit(812, 37)).toBe(36);
    expect(columnsThatFit(812, 20)).toBe(67);
    expect(columnsThatFit(1, 100)).toBe(1);
  });

  it('turns an empty snippet into no lines at all', () => {
    expect(codeLayout({ code: '', baseFontSize: 40 }).lines).toEqual([]);
  });
});
