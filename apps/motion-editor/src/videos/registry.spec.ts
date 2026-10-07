/**
 * Integración: ejercita el `import.meta.glob` REAL una sola vez (DEC-73-007).
 * La lógica ya está cubierta por build-registry.spec.ts con mapas sintéticos;
 * este test sólo confirma que el adaptador conecta bien con el disco real.
 *
 * NOTA de alcance (Épica B, TASK-FE-73-12/13/14/15): además de `como-funciona`
 * ya migrado, ahora existen `conexion-core-pro` (renombrado desde
 * `conexion-raspberry` por corrección de nomenclatura del dueño) y
 * `conexion-mostrador` — no es una regresión, es la evolución esperada
 * documentada en architect.md §11.
 */
import { describe, expect, it } from 'vitest';
import { REGISTRY } from './registry';

describe('REGISTRY (real, import.meta.glob)', () => {
  it('descubre los tres videos instructivos, sin errores', () => {
    const slugs = REGISTRY.videos.map((v) => v.slug);
    expect(slugs).toContain('como-funciona');
    expect(slugs).toContain('conexion-core-pro');
    expect(slugs).toContain('conexion-mostrador');
    expect(REGISTRY.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('defaultSlug es un video playable', () => {
    expect(REGISTRY.defaultSlug).not.toBeNull();
    expect(REGISTRY.bySlug.get(REGISTRY.defaultSlug as string)?.playable).toBe(true);
  });
});
