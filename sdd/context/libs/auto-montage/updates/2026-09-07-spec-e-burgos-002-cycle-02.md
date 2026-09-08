# spec-e-burgos-002 cycle-02 — 2026-09-07

## Estado

La lib pasa de "sabe qué hay en el proyecto" a "decide el montaje completo". `autoMontage(project,
{ preset, seed }, deps)` lee `work/catalog.json`, resuelve A-roll / música / transcripción / formato,
poda silencios, planifica punch-ins, detecta conceptos, planifica B-roll, agrupa captions, planifica
ducking y transiciones, y devuelve `{ edl, timeline, ... }` con ambos documentos validados contra los
schemas de `timeline-core`. Con `persist !== false` los escribe en `work/edl.json` y
`work/timeline.json`. Determinismo byte a byte por `(proyecto, preset, seed)` verificado sobre el
pipeline completo. 281 tests, 98,7 % stmts / 93,03 % branches.

resuelve: `context_prompt.md` § "Qué sigue" de cycle-01 — el keyword spotting, el planificador de
B-roll, los 4 presets y `autoMontage` ya no son pendientes.

## Estructura

Cuatro paquetes nuevos bajo `src/`, todos de funciones puras salvo el orquestador y los writers:

- `presets/` — `MontagePreset` y los 4 presets (`software-demo`, `hardware`, `recipe`,
  `educational`) más `preset-registry.ts` con `MONTAGE_PRESETS` y `resolveMontagePreset` (acepta un
  nombre o un preset completo; lanza `MontageInputError('unknown-preset')`). `ClipFit` se deriva
  localmente como `NonNullable<VideoClip['fit']>` porque no está en el barrel de `timeline-core`.
  Invariante duro con test: `punchIn.every >= 2` en los 4.
- `concepts/` — `normalizeTerm` (minúsculas, sin diacríticos ni puntuación), `resolveStopwords`
  (por idioma, degrada a lista vacía sin caer a español — D-16/A-5) y `spotConcepts`, barrido
  greedy-longest-first sobre el diccionario del preset con caída al camino de frecuencia.
- `broll/` — `assetTokens` (tokeniza subcarpetas + nombre de archivo, D-14), `buildBrollIndex`
  (ordenado por `assetId` ascendente, independiente del orden del catálogo), `selectBrollAsset`
  (rol → especificidad → `assetId`) y `planBrollOverlays`, barrido cronológico que emite
  `overlays` y `rejections` tipadas (`no-candidate`, `punch-in-overlap`, `outside-keep`,
  `repeat-window`, `overlay-gap`, `coverage-cap`, `too-short`).
- `montage/` — `pruneSilencesWithFrameMargin` (y el check `empty-aroll`, que corre ANTES de podar),
  `resolveMontageInputs`, `planCaptionGroups`, `planDuckRanges`, `planTransitions`, `keepWindow`,
  `buildEditDecisionList`, `assertValidEditDecisionList` / `assertValidTimeline`,
  `serializeMontageDocument` y los writers `writeEditDecisionList` / `writeTimeline`.

Patrones a respetar en el próximo ciclo:

- **Los rechazos son datos, no silencio.** Todo lo que el planificador descarta sale en
  `brollRejections` con motivo tipado. No agregar descartes mudos.
- **Nada de reloj, entorno ni azar sin seed** en `src/` fuera de `smoke.ts`: es la condición de
  CA-012. Cualquier test que compare bytes entre dos corridas completas del pipeline tiene que
  inyectar un `Clock` fijo a `ingestProject`, si no es un falso rojo.
- **El orden de claves de lo que se persiste lo fija el schema tras `.parse()`**, no el literal de
  construcción (D-18). Comparar contra `JSON.stringify(fixture)` crudo falla.
- Errores nuevos: `MontageInputError` (`MONTAGE_INPUT_INVALID`, con `reason`),
  `EditDecisionListInvalidError` y `TimelineInvalidError`.
- `project-paths.ts` gana `editDecisionListPath()` y `timelinePath()` — rutas puras y hardcodeadas
  bajo `work/`, nunca bajo `raw/`.

## Dependencias

Ninguna dependencia npm nueva. Se amplía el consumo de `@video-maker/timeline-core`
(`planPunchIns`, `pruneSilences`, `detectSilencesFromWords`, `remapMsAfterCuts`,
`groupWordsForCaptions`, `planDucking`, `buildTimeline`, `validateTimeline`) y se sigue usando
`@video-maker/media-local` solo por `ReadTextFile`/`nodeReadTextFile`.

Cambio aditivo en `libs/timeline-core` para cerrar D-4: `ClipTransform` gana `anchor` opcional y
`buildTimeline` lo propaga. Documentado en el fragmento propio de esa lib.

## Qué sigue

- `cycle-03` (`tools/render-cli`) consume `autoMontage` desde el barrel: `autoMontage`,
  `resolveMontagePreset`, `MONTAGE_PRESETS`, `serializeMontageDocument`, `writeEditDecisionList`,
  `writeTimeline` y los tipos `AutoMontageOptions`/`AutoMontageResult`/`MontageDependencies` ya
  están exportados en `src/index.ts`.
- `auto-montage.ts:158-159` (fallbacks `??` a `nodeWriteTextFile`/`nodeEnsureDirectory`) queda sin
  cubrir por el mismo motivo que `ingestProject`: forzarlo exige filesystem real, que el lint
  prohíbe fuera de `src/fs/`. Si el patrón se repite, extraer la resolución de dependencias por
  defecto a una función testeable.
- El `anchor` llega hasta `work/timeline.json` pero todavía no al render: falta que `cycle-03`
  cablee `punchInStyle` en `composition-remotion`.
