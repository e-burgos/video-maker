# Context Prompt — libs/auto-montage

> Entry point para agentes que trabajen sobre `libs/auto-montage`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: FIX-e-burgos-009-002 | Fecha: 2026-09-11
> Consolidado al cerrar `FIX-e-burgos-009-002` (fundió los fragmentos de `spec-009 cycle-01`,
> `spec-014 cycle-01`, `FIX-003-003`, `FIX-007-002` y `FIX-009-002`).

- **Tipo:** lib Node TypeScript (orquestación del pipeline, sin render)
- **Estado:** operativa de punta a punta en el plano de decisión y en desarrollo activo vía fixes.
  `ingestProject` descubre y clasifica `raw/` (seis roles: `aroll`, `broll`, `music`, `image`,
  `voice`, `logo`), sondea vía `probeMedia` (mide loudness de todo asset `audio`), transcribe el
  A-roll de forma incremental y persiste `work/catalog.json`.
  `autoMontage(project, { preset, seed, voice, captionStyle }, deps)` lee el catálogo, resuelve
  A-roll/música/transcripción/formato/logo, elige la fuente de habla (`aroll` o `script`, ver
  constitution.md), alinea guion si corresponde, poda silencios, planifica punch-ins, detecta
  conceptos, planifica B-roll, agrupa captions con el estilo resuelto, planifica ducking y
  transiciones, y devuelve `{ edl, timeline, captionStyle, voiceSource, voiceTrack, logoAssetId,
  scriptAlignment, ... }` con ambos documentos validados contra los schemas de `timeline-core`; con
  `persist !== false` los escribe en `work/edl.json` y `work/timeline.json`.
  Determinismo byte a byte por `(proyecto, preset, seed)` verificado sobre el pipeline completo, y
  también contra binarios reales y a través del render (`ingestProject → autoMontage →
  renderTimeline` sobre `media/smoke-ingest` desde `tools/render-cli`, repetido tras borrar
  `work/`/`out/`: `edl.json` idéntico byte a byte, `timeline.json` idéntico módulo `probedAt`,
  `framemd5` idéntico de un MP4 1080×1920@30 de 538 frames).
- **Suite:** 45 archivos / 345 tests, 98,7 % stmts · 94,05 % branch.
- **Ciclos y fixes:** `spec-e-burgos-002` cerró `completed` en 3 ciclos (ingesta, montaje, consumo
  externo desde `tools/render-cli`). Desde entonces la lib siguió creciendo por ciclos de otras
  specs y por fixes: `spec-e-burgos-009-voice-over` `cycle-01` (rol `voice`),
  `spec-e-burgos-014-production-quality` `cycle-01` (loudness medido, rol `logo`, niveles de música
  por preset, alineación de guion), `FIX-003-003` (estilo de captions resuelto por preset),
  `FIX-007-002` (fuente de habla `aroll`/`script`) y `FIX-009-002` (guion cronometrado).
- **Precisiones de contrato confirmadas por consumo externo (cycle-03 de spec-002):**
  `IngestResult.catalogPath` y `probeFailures[].path` ya vienen relativos al proyecto;
  `resolveBinaries(env)` de `media-local` es asíncrona (`Promise<ResolvedBinaries>`); y
  `EditDecisionList.decisions` es un único array discriminado por `type`, no arrays separados por
  tipo — ver detalle en `constitution.md`.
- **Specs que la gobiernan:**
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (la creó), `spec-e-burgos-009-voice-over` (rol `voice`, fuente de habla `script` vía
  `FIX-007-002`/`FIX-009-002`), `spec-e-burgos-014-production-quality` (loudness, rol `logo`,
  alineación de guion) y `spec-e-burgos-003-kinetic-captions` (`FIX-003-003`, estilo de captions).
- **Depende de:** `@video-maker/timeline-core` y `@video-maker/media-local`
  (leer sus `sdd/context/libs/*/` + `updates/` antes de tocar esta lib)
- **Cómo correr y testear:** `pnpm nx test auto-montage`, `pnpm nx lint auto-montage`,
  `pnpm nx build auto-montage`. Smoke con binarios reales: `pnpm nx run auto-montage:smoke`
  (fuera de CI; ver README para regenerar `media/smoke-ingest`).
- **Consumidores:** `tools/render-cli` (integrado desde cycle-03) y `apps/render-api` (activo,
  consume el barrel para los jobs `montage`/`voice`/`storyboard`).
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
- `ASSET_ROLE_ORDER` del reporte de `render-cli` sigue sin `voice` ni `logo` (el logo se nombra en
  su propia línea aparte). La subida de un logo por HTTP quedó fuera de esta lib: entra por disco.
- La duración del montaje en modo `script` con voz `aroll`-transcrita: `voiceTrack.truncatedMs` y
  `narrationEndMs` (modo cronometrado) publican el recorte, pero nadie lo resuelve terminando con
  la voz congelando el último frame del A-roll — eso necesita un tipo de clip nuevo en
  `timeline-core` (un `VideoClip` que dura más que su asset es hoy `CLIP_EXCEEDS_ASSET`), no un
  flag del montaje.
- Ensanchar `AssetRole` sigue siendo un cambio global (ver constitution.md): un `Record<AssetRole,
  …>` nuevo en cualquier subproyecto lo va a exigir el compilador.
