# FIX-e-burgos-085 — Inventario técnico de docs-site

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-13 |
| **Estado** | implemented |

## Qué falló
- La #56 sumó `libs/studio-capabilities` y `tools/plugin-references`, pero `tech-inventory.mjs` seguía listando 15 subproyectos y su test falló en `ci:local`.

## Solución
- Se agregan las dos entradas al inventario y el texto de Nx pasa a 17 subproyectos.
