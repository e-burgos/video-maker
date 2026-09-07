# Context Prompt — libs/media-local

> Entry point para agentes que trabajen sobre `libs/media-local`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07

- **Tipo:** lib Node TypeScript (wrappers de binarios locales)
- **Estado:** en construcción — `cycle-02` de `spec-e-burgos-001-core-composition-media-pipeline` abierto el 2026-09-07
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (sección "Wrappers locales (libs/media-local)")
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test media-local`, `pnpm nx lint media-local`, `pnpm nx build media-local`
- **Consumidores previstos:** `libs/auto-montage`, `apps/render-api`, `tools/render-cli`
