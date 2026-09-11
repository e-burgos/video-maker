import { describe, expect, it } from 'vitest';

import { scanLiteralCopy, stripExpressions } from './literal-copy-scan';

describe('stripExpressions', () => {
  it('drops every jsx expression, so an arrow body is never read as markup', () => {
    expect(stripExpressions('<button onClick={() => send("go")}>{t("a.b")}</button>')).toBe(
      '<button onClick= > </button>',
    );
  });

  it('drops nested expressions whole', () => {
    expect(stripExpressions('<p>{cond ? t({ a: 1 }) : null}</p>')).toBe('<p>  </p>');
  });
});

describe('scanLiteralCopy', () => {
  it('flags a sentence written straight into the markup', () => {
    const offences = scanLiteralCopy('<p className="text-sm">No projects yet.</p>');

    expect(offences).toEqual([{ kind: 'jsx-text', text: 'No projects yet.' }]);
  });

  it('flags copy hidden in an accessible name', () => {
    const source = '<input aria-label="Message for the producer" value={draft} />';

    expect(scanLiteralCopy(source)).toEqual([
      { kind: 'attribute', text: 'aria-label="Message for the producer"' },
    ]);
  });

  it('flags a placeholder, a title and an alt text too', () => {
    const source =
      '<img alt="A logo drawn over the video" title="Re-check the render service" />' +
      '<input placeholder="my next reel" />';

    expect(scanLiteralCopy(source).map((offence) => offence.kind)).toEqual([
      'attribute',
      'attribute',
      'attribute',
    ]);
  });

  it('accepts markup whose text comes from the catalog', () => {
    const source = `
      <p className="text-sm text-slate-500">{t('projects.empty')}</p>
      <input placeholder={t('createProject.placeholder')} aria-label={t('createProject.label')} />
    `;

    expect(scanLiteralCopy(source)).toEqual([]);
  });

  it('accepts the separators and symbols the studio draws between values', () => {
    const source = "<span>{a} · {b}</span><button>{playing ? '■' : '▶'} {t('x')}</button>";

    expect(scanLiteralCopy(source)).toEqual([]);
  });

  it('accepts the technical units that read the same in every language', () => {
    expect(scanLiteralCopy('<span>{width}×{height} @ {fps} fps</span>')).toEqual([]);
    expect(scanLiteralCopy('<span>{count} kB</span>')).toEqual([]);
  });

  it('does not mistake a className or a data attribute for copy', () => {
    const source = '<li data-testid="asset-role-choice" className="rounded-lg border p-3" />';

    expect(scanLiteralCopy(source)).toEqual([]);
  });
});
