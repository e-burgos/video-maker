// @vitest-environment node
/**
 * Test-first (TASK-TEST-FE-74-D00, DEC-74-007). Verifica que la escena
 * `Hardware` de `acto3-ia.tsx` y el tramo 01:21–01:30 de
 * `guion-locucion.md` dejaron de comunicar cifras en USD y el
 * multiplicador "5×" (DEC-OWNER-34-04/05), y que en su lugar quedó el
 * claim de garantía vitalicia de **Plan Flex** (INV-LOCAL-34-7): el nombre
 * del plan tiene que estar presente en las tres superficies, y el
 * competidor nunca se nombra ("otros proveedores").
 *
 * Este test se escribe ANTES de tocar la escena: hoy falla contra el
 * contenido vigente (que todavía dice "5× menos" y "USD 80 – 200"); pasa a
 * verde recién cuando TASK-FE-74-D01/D02 reescriben el copy literal de
 * architect.md §2.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCENE_PATH = join(__dirname, 'acto3-ia.tsx');
const GUION_PATH = join(__dirname, '..', 'guion-locucion.md');

/** Extrae el bloque de locución del tramo 01:21–01:30 del guion completo. */
function extraerTramoHardware(guion: string): string {
  const inicio = guion.indexOf('**01:21 – 01:30 · Hardware**');
  expect(inicio, 'no se encontró el encabezado del tramo 01:21–01:30 en guion-locucion.md').toBeGreaterThan(-1);
  const resto = guion.slice(inicio);
  const finRelativo = resto.indexOf('\n\n**', 1);
  return finRelativo === -1 ? resto : resto.slice(0, finRelativo);
}

describe('escena Hardware (acto3-ia.tsx) — DEC-74-007', () => {
  const scene = readFileSync(SCENE_PATH, 'utf-8');

  it('no contiene cifras en USD ni el multiplicador "5×"/"5x" (DEC-OWNER-34-04/05)', () => {
    expect(scene).not.toMatch(/USD/i);
    expect(scene).not.toMatch(/5×/);
    expect(scene).not.toMatch(/\b5x\b/i);
  });

  it('nombra "Plan Flex" en el mismo archivo que el claim de garantía (INV-LOCAL-34-7)', () => {
    expect(scene).toMatch(/Plan Flex/);
  });

  it('no nombra al competidor por marca/razón social (usa "otros proveedores")', () => {
    expect(scene).not.toMatch(/banner|director/i);
  });

  it('el campo `garantia` de COMPARATIVA existe y `precio` ya no (DEC-74-007 §2b)', () => {
    expect(scene).toMatch(/garantia:/);
    expect(scene).not.toMatch(/precio:/);
  });
});

describe('locución 01:21–01:30 (guion-locucion.md) — DEC-74-007', () => {
  const guion = readFileSync(GUION_PATH, 'utf-8');
  const tramo = extraerTramoHardware(guion);

  it('no contiene cifras en USD ni el multiplicador "5×"/"cinco veces"', () => {
    expect(tramo).not.toMatch(/dólar/i);
    expect(tramo).not.toMatch(/5×/);
    expect(tramo).not.toMatch(/cinco veces/i);
  });

  it('nombra "Plan Flex" en el tramo (INV-LOCAL-34-7)', () => {
    expect(tramo).toMatch(/Plan Flex/);
  });

  it('no nombra al competidor por marca/razón social', () => {
    expect(tramo).not.toMatch(/banner|director/i);
  });

  it('tiene exactamente 29 palabras contadas (DEC-74-007 §2c)', () => {
    // Cuenta sólo el texto de locución, descartando el encabezado del tramo.
    const soloTexto = tramo.replace(/\*\*01:21 – 01:30 · Hardware\*\*/, '').trim();
    const palabras = soloTexto.split(/\s+/).filter(Boolean);
    expect(palabras).toHaveLength(29);
  });
});
