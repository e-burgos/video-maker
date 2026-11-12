# FIX-e-burgos-078 — Studio descubrible y catálogo de capacidades

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Plan** | docs/plans/2026-11-12-plugin-video-maker.md |

## Solución
- `~/.video-maker/studio.<source>.json` al escuchar, borrado al cerrar.
- `/health` con `version`; `GET /capabilities` desde `libs/studio-capabilities`.
