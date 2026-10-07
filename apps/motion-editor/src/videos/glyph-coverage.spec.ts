// @vitest-environment node
/**
 * Cobertura de glifos (DEC-73-006 §8.4 Paso C.2, TASK-FE-73-18). Lee los
 * `.tsx`/`.ts` de CONTENIDO DE ESCENA (`src/videos/**`, `src/components/**`
 * — la frontera de architect.md §2) con `fs`, descarta comentarios y compara
 * los codepoints > U+00FF que aparecen en el resto contra una allow-list
 * explícita y documentada glifo por glifo. Un glifo nuevo y exótico en
 * cualquier video (incluidos los futuros de la Épica B) rompe este test con
 * un mensaje que lo nombra: es la única forma de que el recorte de fuentes
 * de DEC-73-006 no se rompa en silencio dentro de seis meses.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_ROOT = join(__dirname, '..', '..');
const CONTENT_ROOTS = [join(APP_ROOT, 'src', 'videos'), join(APP_ROOT, 'src', 'components')];

/**
 * Allow-list de codepoints > U+00FF, documentada glifo por glifo. Todos
 * caen en el rango `latin` que sirve Google Fonts (U+2000-206F + U+2212
 * explícito): están cubiertos por el `unicode-range` de `index.html`
 * (DEC-73-006). Si aparece un glifo nuevo que NO esté acá, el test lo
 * nombra y falla: hay que decidir a mano si se agrega a la allow-list (y
 * confirmar que el subset `latin` lo cubre) o si se reemplaza por un `Glyph`
 * SVG / separador con `borderTop` (regla de la Épica B, architect.md §8.6).
 */
const ALLOWED_CODEPOINTS: ReadonlyMap<number, string> = new Map([
  [0x2013, '– en dash — cubierto por el subset `latin` (U+2000-206F).'],
  [0x2014, '— em dash — cubierto por el subset `latin` (U+2000-206F).'],
  [0x201c, '“ comilla curva de apertura — cubierto por el subset `latin` (U+2000-206F).'],
  [0x201d, '” comilla curva de cierre — cubierto por el subset `latin` (U+2000-206F).'],
  [0x2026, '… puntos suspensivos — cubierto por el subset `latin` (U+2000-206F).'],
  [0x2212, '− signo menos — cubierto explícitamente en el `unicode-range` del subset `latin`.'],
]);

/**
 * Elimina comentarios de bloque `/* … *\/` y de línea `//` de forma naive
 * (no respeta comillas/template literals). Suficiente para este barrido:
 * el código de contenido de escena no tiene URLs ni strings con `//` (se
 * verificó al escribir este test); si algún día los tuviera, un falso
 * negativo (glifo real no detectado) es más seguro que un falso positivo.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (two === '//') {
      const end = source.indexOf('\n', i + 2);
      i = end === -1 ? n : end;
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectContentFiles(): string[] {
  return CONTENT_ROOTS.filter((root) => {
    try {
      return statSync(root).isDirectory();
    } catch {
      return false;
    }
  }).flatMap((root) => walk(root));
}

describe('cobertura de glifos del contenido de escena (DEC-73-006)', () => {
  it('todo codepoint > U+00FF que aparece en contenido (no comentarios) está en la allow-list', () => {
    const files = collectContentFiles();
    expect(files.length).toBeGreaterThan(0); // guarda contra un barrido vacío por path roto

    const offenders: string[] = [];

    for (const file of files) {
      const raw = readFileSync(file, 'utf-8');
      const content = stripComments(raw);
      const seen = new Set<number>();
      for (const ch of content) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp > 0xff && !seen.has(cp)) {
          seen.add(cp);
          if (!ALLOWED_CODEPOINTS.has(cp)) {
            offenders.push(
              `${file}: glifo "${ch}" (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) no está en la allow-list de glyph-coverage.spec.ts.`,
            );
          }
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('la allow-list documenta cada codepoint con una razón no vacía', () => {
    for (const [cp, reason] of ALLOWED_CODEPOINTS) {
      expect(reason.trim().length, `U+${cp.toString(16)} sin justificación`).toBeGreaterThan(0);
    }
  });
});
