# spec-e-burgos-014-production-quality — cycle-01 · plan (lite)

> Módulo: production-quality | Subprojectos: libs/timeline-core, libs/media-local,
> libs/auto-montage, libs/composition-remotion, tools/render-cli, apps/render-api |
> Fecha: 2026-09-10 | Flow: **lite** (decisión del dev, prefijo `[LITE]`; un solo actor con tres
> sombreros: escribe este plan, implementa task por task y cierra como reviewer).
> Objetivo: cerrar los tres defectos de calidad de producción que el dev encontró en el primer
> video real (`media/demo-01`): música inaudible, captions que no dicen lo que dice la voz, y
> ausencia de logo. Fuera de alcance: `apps/web` (el check del logo y el selector de guion llegan
> con la pantalla del chat), el rol `logo` en la subida de assets de `render-api`, estilos de
> caption, y cualquier cambio en el ritmo del montaje.

## Historias

- US-14-001 — Como espectador quiero escuchar la música de fondo bajo la voz para que el video
  no suene vacío. CA: con el preset `hardware`, el bed aislado del re-render de `demo-01` mide
  entre -26 y -30 LUFS integrados con la voz en -15 ± 1, y la voz sigue dentro de la tolerancia
  de `verifyMixLoudness`.
- US-14-002 — Como productor quiero que cada preset traiga el nivel de música adecuado a su caso
  (publicidad vs tutorial) para no ajustarlo a mano. CA: `hardware` -4/-12 dB y
  `software-demo`/`educational`/`recipe` -8/-18 dB llegan a `timeline.audioMix.music` y a la
  automation, verificado por test (hoy `buildTimeline` los ignoraba).
- US-14-003 — Como productor quiero que las captions digan exactamente lo que escribí en el guion
  para no entregar un video con palabras inventadas. CA: re-plan de `demo-01` con `--script`:
  todas las palabras de las captions pertenecen al guion (`dice`, `calma`, `necesitás`, `Vení`),
  0 palabras ajenas, y los conceptos se siguen detectando.
- US-14-004 — Como productor quiero pasar el guion desde la CLI y desde el job `montage` para
  usar la corrección sin tocar código. CA: `--script <ruta>` en `plan` y `run` con el reporte de
  cuántas palabras se corrigieron, y `scriptPath`/`scriptText` en `POST /projects/:slug/jobs`
  registrados en `sdd/api.json`.
- US-14-005 — Como marca quiero mi logo en el video, por defecto abajo a la derecha. CA: frames
  a 5 s y 20 s del re-render de `demo-01` con el logo visible en el margen inferior derecho,
  dentro del cuadro y sin pisar las captions.
- US-14-006 — Como dev quiero que un proyecto sin logo renderice exactamente igual que antes.
  CA: `video-muted.mp4` de `media/smoke-ingest` byte-idéntico al oráculo
  `sha256 c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb`.

## Tasks (detalle en tasks.json)

- TASK-001 — `timeline-core`: `MusicMixSettings.referenceLufs` (default -16), la función pura
  `musicNormalizationGainDb(measuredLufs, referenceLufs)` con clamp de ±18 dB, `MusicInput.mix`
  para que el preset llegue a `audioMix.music` y a `planDucking`, `LogoOverlaySchema` +
  `Timeline.logo`, validación (`LOGO_ASSET_NOT_FOUND`, `LOGO_ASSET_NOT_IMAGE`) y los JSON Schema
  regenerados con `nx run timeline-core:schemas`. Lo validan `music-normalization.spec.ts`,
  `build-timeline.spec.ts`, `validate-timeline.spec.ts` y `schemas.spec.ts`.
- TASK-002 — `media-local`: `buildMusicBedChain` antepone `volume=<g>dB` con la ganancia de
  normalización derivada del asset, y `apad` pasa a `apad=whole_dur=<dur>`. Lo validan
  `build-music-bed-chain.spec.ts` y `build-audio-mix-graph.spec.ts` (string exacto del
  filtergraph).
- TASK-003 — `auto-montage`: el ingest mide el loudness de los assets de rol `audio` con
  `measureLoudness` y lo guarda en `asset.audio.integratedLufs`; un catálogo previo sin esa
  medición no se reutiliza; rol `logo` en `raw/logo/` (png/jpg/webp); los cuatro presets pasan a
  los niveles de publicidad; `autoMontage` pasa `preset.audio` y el logo a `buildTimeline`
  (`logo: 'auto' | 'off'`). Lo validan `probe-assets.spec.ts`, `plan-ingest-work.spec.ts`,
  `classify-entry.spec.ts`, `preset-registry.spec.ts` y `auto-montage.spec.ts`.
- TASK-004 — `auto-montage`: `alignTranscriptToScript(words, scriptText)` con LCS sobre tokens
  normalizados, opción `scriptText` de `autoMontage` y contadores en el resultado. Lo valida
  `align-transcript-to-script.spec.ts` (sustitución, inserción de Whisper, omisión con hueco,
  omisión sin hueco, n:k) más `auto-montage.spec.ts`.
- TASK-005 — `composition-remotion`: `logoOverlayStyle` puro (geometría por posición),
  `LogoOverlay` montado entre el B-roll y las captions, y el `<Audio>` de música multiplicando
  por la misma ganancia de normalización. Lo validan `logo-overlay-style.spec.ts`,
  `timeline-composition.spec.tsx`, `sequence-props.spec.ts` y `audio-track.spec.tsx`.
- TASK-006 — `render-cli`: `--script <ruta>` en `plan`/`run`, `--no-logo`, y las líneas
  `script-corrections` y `logo` del reporte de `plan`. Lo validan `parse-cli-args.spec.ts`,
  `plan-command.spec.ts`, `to-reports.spec.ts` y `format-report.spec.ts`.
- TASK-007 — `render-api`: el job `montage` acepta `scriptPath`, `scriptText` y `logo`, con
  `MONTAGE_SCRIPT_INVALID` (422) y `MONTAGE_SCRIPT_NOT_FOUND` (surge al asentar el job);
  `sdd/api.json` EP-012 `updated`. Lo validan `montage-job-params.spec.ts`,
  `run-montage-pipeline.spec.ts` y `jobs-handler.spec.ts`.
- TASK-008 — Aceptación real sobre `media/demo-01` (re-ingest, re-plan con `--script`, re-render,
  mediciones `ebur128` del bed y de la voz, frames con logo) y no-regresión de
  `media/smoke-ingest`; guion de medición y evidencias en `artifacts/`; skill `video-producer`
  actualizada con las tres novedades.

## Decisiones técnicas

- **D-1 — La medición del loudness de la música vive en el catálogo
  (`MediaAsset.audio.integratedLufs`), no en el mix** → registro afectado: ninguno de
  `schema.json`/`api.json`; el campo ya existía en `media-asset.schema.json` y estaba sin usar.
  Motivo: el MP4 que el productor entrega hoy sale de `render-cli run`, cuyo audio lo renderiza
  **Remotion**, no el grafo de FFmpeg. Medir dentro de `mixTimelineAudio` habría arreglado sólo el
  camino de `render-api`. Con la medición en el catálogo, la `Timeline` es autodescriptiva y los
  **dos** renderers derivan la misma ganancia de la misma función pura.
- **D-2 — La normalización se aplica como `volume=<g>dB`, no como una segunda pasada de
  `loudnorm`** → `audio-mix-plan.json`. Es una ganancia lineal invariante en el tiempo: no
  resamplea a 192 kHz, no depende de `measured_*` y se testea como string exacto. La referencia es
  `audioMix.music.referenceLufs` (default **-16 LUFS**), y el clamp de ±18 dB evita que una pista
  casi muda se amplifique hasta el ruido de fondo.
- **D-3 — `apad` pasa a `apad=whole_dur=<duración del video en s>`** (antes `apad` a secas, que
  produce un stream infinito acotado sólo por el `atrim` siguiente). El `atrim=end` se conserva
  porque también recorta una música más larga que el edit. Cambio de contrato deliberado: los
  tests de string del filtergraph se actualizan.
- **D-4 — Los niveles de música son un contrato nuevo y deliberado:** `hardware` -4/-12,
  `software-demo`/`educational`/`recipe` -8/-18. Además `buildTimeline` deja de hardcodear
  `DEFAULT_MUSIC_MIX`: los toma de `MusicInput.mix`. Sin esto, cambiar los presets es un no-op
  (el consumidor real es `audioMix.automation`, que se derivaba de la constante).
- **D-5 — Palabras del guion que Whisper omitió.** Un bloque de diferencia es un run de *n*
  palabras de Whisper reemplazado por *k* palabras del guion. Si `n ≥ 1`, el span
  `[inicio de la primera, fin de la última]` se reparte en *k* tramos iguales (cubre 1:1, 2:1 como
  `Ven y → Vení`, y 1:2). Si `n = 0` (omisión pura) las *k* palabras se reparten en el hueco
  `[fin de la anterior, inicio de la siguiente]` **sólo si el hueco mide al menos *k* ms**; si no
  hay hueco **se descartan** y se cuentan en `droppedScriptWords`. Si `k = 0`, las *n* palabras de
  Whisper se eliminan.
- **D-6 — El logo es `timeline.logo`, un campo opcional en la raíz**, no una sexta pista ni un
  `overlay.logo` anidado → `timeline.json` schema. La web lo prende/apaga con un check y
  presencia/ausencia de un único campo es el contrato más simple; los defaults viven en el schema,
  así que encenderlo sólo requiere `{ assetId }`. Se dibuja **debajo de las captions** y encima
  del B-roll: el logo nunca puede tapar texto. El margen es `marginRatio × width` en los dos ejes
  (un margen en píxeles igual arriba/abajo/izquierda/derecha).
- **D-7 — El rol `logo` NO se agrega a `ASSET_ROLES` de `render-api`** (subida de assets): eso
  ensancharía `AssetCounts` en el payload y `apps/web` está fuera de alcance. El logo entra por
  disco (`raw/logo/`) y por el ingest. Follow-up para la spec de la pantalla del chat.
