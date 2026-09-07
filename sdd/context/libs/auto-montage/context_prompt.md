# Context Prompt — libs/auto-montage

> Entry point para agentes que trabajen sobre `libs/auto-montage`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07

- **Tipo:** lib Node TypeScript (orquestación del pipeline, sin render)
- **Estado:** **todavía no existe en Nx** — la crea `cycle-01` de
  `spec-e-burgos-002-auto-montage-pipeline` con la skill `scaffold-nx`
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
- **Depende de:** `@video-maker/timeline-core` y `@video-maker/media-local`
  (leer sus `sdd/context/libs/*/` + `updates/` antes de tocar esta lib)
- **Cómo correr y testear** (una vez scaffoldeada): `pnpm nx test auto-montage`,
  `pnpm nx lint auto-montage`, `pnpm nx build auto-montage`
- **Consumidores previstos:** `tools/render-cli`, `apps/render-api`
- **Contrato de entrada:** un proyecto de medios `media/<project-slug>/` con
  `raw/` (solo lectura) · `work/` (regenerable) · `out/` (renders). Ver la sección
  "Contrato de entrada: layout de `media/`" de la spec.
