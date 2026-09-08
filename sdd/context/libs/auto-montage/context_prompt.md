# Context Prompt — libs/auto-montage

> Entry point para agentes que trabajen sobre `libs/auto-montage`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-03 | Fecha: 2026-09-08

- **Tipo:** lib Node TypeScript (orquestación del pipeline, sin render)
- **Estado:** operativa de punta a punta en el plano de decisión.
  `ingestProject` descubre y clasifica `raw/`, sondea vía `probeMedia`, transcribe el A-roll de
  forma incremental y persiste `work/catalog.json`.
  `autoMontage(project, { preset, seed }, deps)` lee el catálogo, resuelve A-roll / música /
  transcripción / formato, poda silencios, planifica punch-ins, detecta conceptos, planifica B-roll,
  agrupa captions, planifica ducking y transiciones, y devuelve `{ edl, timeline, ... }` con ambos
  documentos validados contra los schemas de `timeline-core`; con `persist !== false` los escribe en
  `work/edl.json` y `work/timeline.json`.
  Determinismo byte a byte por `(proyecto, preset, seed)` verificado sobre el pipeline completo, y
  desde cycle-03 verificado también contra binarios reales y a través del render: dos corridas
  `ingestProject → autoMontage → renderTimeline` sobre `media/smoke-ingest` (encadenadas desde
  `tools/render-cli`), repitiendo tras borrar `work/` y `out/`, produjeron un `edl.json` byte a byte
  idéntico, un `timeline.json` idéntico módulo `probedAt` y un `framemd5` idéntico de un MP4
  1080×1920@30 de 538 frames.
- **Ciclos completados:** cycle-01 (ingesta) y cycle-02 (montaje). 281 tests,
  98,7 % statements / 93,03 % branches. **La spec-e-burgos-002 cerró `completed` en cycle-03** (3
  ciclos en total); ese ciclo no modificó código de esta lib — consumió el barrel desde
  `tools/render-cli`. No hay más ciclos planificados: la lib pasa a modo consumo.
- **Precisiones de contrato confirmadas por consumo externo (cycle-03):**
  `IngestResult.catalogPath` y `probeFailures[].path` ya vienen relativos al proyecto;
  `resolveBinaries(env)` de `media-local` es asíncrona (`Promise<ResolvedBinaries>`); y
  `EditDecisionList.decisions` es un único array discriminado por `type`, no arrays separados por
  tipo — ver detalle en `constitution.md`.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
- **Depende de:** `@video-maker/timeline-core` y `@video-maker/media-local`
  (leer sus `sdd/context/libs/*/` + `updates/` antes de tocar esta lib)
- **Cómo correr y testear:** `pnpm nx test auto-montage`, `pnpm nx lint auto-montage`,
  `pnpm nx build auto-montage`. Smoke con binarios reales: `pnpm nx run auto-montage:smoke`
  (fuera de CI; ver README para regenerar `media/smoke-ingest`).
- **Consumidores:** `tools/render-cli` (integrado, consume el barrel desde cycle-03),
  `apps/render-api` (consumidor futuro, spec-005)
- **Contrato de entrada:** un proyecto de medios `media/<project-slug>/` con
  `raw/` (solo lectura) · `work/` (regenerable) · `out/` (renders). Ver la sección
  "Contrato de entrada: layout de `media/`" de la spec.

## Qué sigue

- La receta de regeneración de `media/smoke-ingest` documentada en el README de esta lib quedó
  incompleta: si el A-roll se regenera con más frases, la duración editada sube y
  `raw/audio/music01.mp3` puede quedar más corto que la timeline editada, lo que hace que
  `autoMontage` rechace la Timeline con `TIMELINE_INVALID` / `CLIP_EXCEEDS_ASSET`. Hay que alargar
  la música junto con el A-roll (p. ej. `ffmpeg -stream_loop … -c copy` sobre el propio clip, sin
  sintetizar audio nuevo). La receta corregida y el comando exacto están en el README de
  `tools/render-cli`; falta trasladarla acá la próxima vez que se toque esta lib.
- `auto-montage.ts:158-159` (fallbacks `??` a `nodeWriteTextFile` / `nodeEnsureDirectory`) sigue sin
  cubrir por el mismo motivo que `ingestProject`: forzarlo exige filesystem real, que el lint
  prohíbe fuera de `src/fs/`. Si el patrón se repite, extraer la resolución de dependencias por
  defecto a una función testeable.
