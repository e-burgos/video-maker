# FIX-e-burgos-080 — Referencias generadas y test de atraso

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Plan** | docs/plans/2026-11-12-plugin-video-maker.md |

## Solución
- `pnpm nx run plugin-references:plugin-references` regenera las referencias.
- El test compara lo generado y los campos que nombran las skills.
