# FIX-e-burgos-096 — Test de marcas sin depender de brands/ local

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-16 |
| **Estado** | implemented |

## Qué cambia
- `tools/plugin-references/src/brands.spec.ts` valida las marcas incluidas (`libs/motion-graphics/assets/brands`) y suma las de `brands/` solo si existe; en CI esa carpeta no está (gitignore) y el test fallaba con ENOENT.
- Probado con y sin `brands/`: 18 y 12 tests en verde.
