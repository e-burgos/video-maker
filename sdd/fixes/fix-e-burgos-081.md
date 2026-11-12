# FIX-e-burgos-081 — Plugin video-maker con skills genéricas

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Plan** | docs/plans/2026-11-12-plugin-video-maker.md |

## Solución
- Cinco skills en `plugins/video-maker/skills/`, sin nada de un repo en particular.
- Marketplace en `.claude-plugin/marketplace.json`; instalación con `/plugin marketplace add e-burgos/video-maker`.
- Se borran las tres skills viejas de `sdd/skills/`; display-ads pasa al plugin.
