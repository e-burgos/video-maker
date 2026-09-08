# Context Prompt — libs/auto-montage

> Entry point para agentes que trabajen sobre `libs/auto-montage`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-09-07

- **Tipo:** lib Node TypeScript (orquestación del pipeline, sin render)
- **Estado:** operativa de punta a punta en el plano de decisión.
  `ingestProject` descubre y clasifica `raw/`, sondea vía `probeMedia`, transcribe el A-roll de
  forma incremental y persiste `work/catalog.json`.
  `autoMontage(project, { preset, seed }, deps)` lee el catálogo, resuelve A-roll / música /
  transcripción / formato, poda silencios, planifica punch-ins, detecta conceptos, planifica B-roll,
  agrupa captions, planifica ducking y transiciones, y devuelve `{ edl, timeline, ... }` con ambos
  documentos validados contra los schemas de `timeline-core`; con `persist !== false` los escribe en
  `work/edl.json` y `work/timeline.json`.
  Determinismo byte a byte por `(proyecto, preset, seed)` verificado sobre el pipeline completo.
- **Ciclos completados:** cycle-01 (ingesta) y cycle-02 (montaje). 281 tests,
  98,7 % statements / 93,03 % branches.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
- **Depende de:** `@video-maker/timeline-core` y `@video-maker/media-local`
  (leer sus `sdd/context/libs/*/` + `updates/` antes de tocar esta lib)
- **Cómo correr y testear:** `pnpm nx test auto-montage`, `pnpm nx lint auto-montage`,
  `pnpm nx build auto-montage`. Smoke con binarios reales: `pnpm nx run auto-montage:smoke`
  (fuera de CI; ver README para regenerar `media/smoke-ingest`).
- **Consumidores:** `tools/render-cli` (cycle-03), `apps/render-api` (spec futura)
- **Contrato de entrada:** un proyecto de medios `media/<project-slug>/` con
  `raw/` (solo lectura) · `work/` (regenerable) · `out/` (renders). Ver la sección
  "Contrato de entrada: layout de `media/`" de la spec.

## Qué sigue

- **cycle-03** — `tools/render-cli`: CLI headless `ingest → edl → timeline → render` que consume
  esta lib desde el barrel y `renderTimeline` de `composition-remotion`. Incluye cablear el
  `anchor` de D-4 en `punchInStyle` para que el punch-in llegue al render.
- `auto-montage.ts:158-159` (fallbacks `??` a `nodeWriteTextFile` / `nodeEnsureDirectory`) queda sin
  cubrir por el mismo motivo que `ingestProject`: forzarlo exige filesystem real, que el lint
  prohíbe fuera de `src/fs/`. Si el patrón se repite, extraer la resolución de dependencias por
  defecto a una función testeable.
