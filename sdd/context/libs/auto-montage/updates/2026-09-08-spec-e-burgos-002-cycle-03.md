# spec-e-burgos-002 cycle-03 — 2026-09-08

> El ciclo **no modificó una sola línea de `libs/auto-montage`** (estaba fuera de alcance por brief).
> Lo que sigue es lo que se aprendió *consumiéndola desde afuera* al construir `tools/render-cli`, más
> los ítems del contexto que este ciclo deja resueltos.

## Estado

- **`resuelve: context_prompt.md → "Qué sigue" → cycle-03.** `tools/render-cli` existe y está
  completo: la CLI headless consume `resolveMediaProject` / `ingestProject` / `autoMontage` desde el
  barrel y `renderTimeline` desde `@video-maker/composition-remotion/render`. El cableado del
  `anchor` de D-4 también quedó hecho (en `libs/composition-remotion/src/components/aroll-series.tsx`,
  no en esta lib).
- **Con esto la spec-002 queda `completed`** (3 ciclos). `libs/auto-montage` no tiene más ciclos
  planificados: pasa a modo consumo.
- **La lib quedó validada de punta a punta contra binarios reales por primera vez.** Dos renders
  reales encadenando `ingestProject → autoMontage → renderTimeline` sobre `media/smoke-ingest`
  produjeron un MP4 1080×1920@30 de 538 frames y, repitiendo tras borrar `work/` y `out/`, un
  `edl.json` byte a byte idéntico, un `timeline.json` idéntico módulo `probedAt` y un `framemd5`
  idéntico. El determinismo por `(proyecto, preset, seed)` que cycle-02 verificó en tests ahora está
  verificado también sobre material real y a través del render.

## Estructura

Sin cambios. Precisiones del contrato público confirmadas empíricamente desde el consumidor, útiles
para el próximo que lo integre:

- **`IngestResult.catalogPath` y `probeFailures[].path` ya vienen relativos al proyecto** (los
  producen `catalogPath()` y `finding.relativePath`). No hay que relativizarlos de nuevo. En cambio
  `RenderOutcome.outPath` de `composition-remotion` **sí es absoluto** y hay que relativizarlo contra
  la raíz del proyecto. La asimetría no es obvia y costó una firma de función en el consumidor.
- **`resolveBinaries(env)` es asíncrona** (`=> Promise<ResolvedBinaries>`), aunque parte de la
  documentación de spec la anota como si devolviera el objeto directo.
- **`EditDecisionList` tiene un único array `decisions` discriminado por `type`**
  (`keep | cut | punch-in | transition | caption-group | duck`), no arrays top-level separados
  (`keeps`, `punchIns`, `transitions`). Cualquier script de verificación tiene que contar por `type`.
  Es el schema de `timeline-core`, pero se pisa desde acá.

## Dependencias

Sin cambios. **Nuevo consumidor: `tools/render-cli`** (`scope:engine`, `type:tool`), que la usa solo
por el barrel. Consumidor futuro pendiente: `apps/render-api` (spec-005).

## Qué sigue

- **La receta de regeneración de `media/smoke-ingest` del README de esta lib quedó incompleta.** Si
  se regenera el A-roll con más frases (D-35 de cycle-03 lo llevó a 6), la duración editada sube a
  ~18,2 s y `raw/audio/music01.mp3` (8 s) queda **más corto que la duración editada**: `autoMontage`
  rechaza la Timeline con `TIMELINE_INVALID` / `CLIP_EXCEEDS_ASSET`. **La música hay que alargarla
  junto con el A-roll**, p. ej. `ffmpeg -stream_loop 4 … -c copy` sobre el propio clip (8 s → 40,2 s,
  mismo contenido, sin sintetizar audio nuevo). La receta corregida y el comando exacto están en el
  README de `tools/render-cli`; el README de esta lib todavía describe solo el material original.
  Corregirlo acá cuando se toque la lib.
- Sigue vigente lo anotado en cycle-02: `auto-montage.ts:158-159` (fallbacks `??` a
  `nodeWriteTextFile` / `nodeEnsureDirectory`) sin cubrir; si el patrón se repite, extraer la
  resolución de dependencias por defecto a una función testeable.
