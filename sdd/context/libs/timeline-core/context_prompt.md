# Context Prompt — libs/timeline-core

> Entry point para agentes que trabajen sobre `libs/timeline-core`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07

- **Tipo:** lib de dominio TypeScript (sin I/O, sin React)
- **Estado:** en construcción — `cycle-01` de `spec-e-burgos-001-core-composition-media-pipeline` abierto el 2026-09-07
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (secciones "Contratos de datos" y "Cálculos del motor")
- **Cómo correr y testear:** `pnpm nx test timeline-core`, `pnpm nx lint timeline-core`, `pnpm nx build timeline-core`
- **Consumidores previstos:** `libs/media-local`, `libs/composition-remotion`, `libs/auto-montage`, `apps/render-api`, `apps/web`
