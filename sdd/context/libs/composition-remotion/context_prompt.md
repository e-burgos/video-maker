# Context Prompt — libs/composition-remotion

> Entry point para agentes que trabajen sobre `libs/composition-remotion`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07

- **Tipo:** lib React 19 + Remotion 4
- **Estado:** en construcción — `cycle-03` de `spec-e-burgos-001-core-composition-media-pipeline` abierto el 2026-09-07
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (sección "Composición (libs/composition-remotion)")
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test composition-remotion`, `pnpm nx lint composition-remotion`, `pnpm nx build composition-remotion`; smoke manual: `pnpm nx run composition-remotion:smoke`
- **Consumidores previstos:** `apps/web` (Player), `apps/render-api`, `tools/render-cli`
