# Constitución — libs/auto-montage

> Versión 1.2 | Última actualización: FIX-e-burgos-009-002 | Fecha: 2026-09-11
> Consolidada al cerrar `FIX-e-burgos-009-002` (fundió los fragmentos de
> `spec-009 cycle-01`, `spec-014 cycle-01`, `FIX-003-003`, `FIX-007-002` y `FIX-009-002`).
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib Node (TypeScript, solo servidor)
- **Rol en el sistema:** el pegamento del motor. Toma un **proyecto de medios**
  (`media/<project-slug>/`), lo ingiere (descubrimiento, probe, transcripción), extrae conceptos de
  la locución, planifica el B-roll y compone los cálculos puros de `timeline-core` en una
  `EditDecisionList` y una `Timeline` validada. No renderiza y no invoca binarios por su cuenta:
  todo binario pasa por `media-local`.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `@video-maker/timeline-core` (contratos y cálculos puros) + `@video-maker/media-local` (probe,
  transcripción) — **cero dependencias npm propias** (D-9); se consume por source vía el alias
  `@video-maker/auto-montage` de `tsconfig.base.json` (la lib no tiene `package.json`)
- `zod` para validar todo lo que se lee de disco (`catalog.json`, `edl.json`, `timeline.json`)
- Vitest; cero binarios y cero filesystem real en CI
- **No** importa `composition-remotion`, `remotion` ni React

## 3. Estructura y patrones

- `src/index.ts` — única superficie pública. Exporta `ingestProject`, `autoMontage`,
  `resolveMontagePreset`, `MONTAGE_PRESETS`, `serializeMontageDocument`, `writeEditDecisionList`,
  `writeTimeline` y los tipos `AutoMontageOptions` / `AutoMontageResult` / `MontageDependencies`.
- `src/project/` — contrato `MediaProject` (`raw`/`work`/`out`), álgebra de rutas
  (`toProjectRelativePath` / `toAbsolutePath`) y `project-paths.ts` con `editDecisionListPath()` y
  `timelinePath()` — rutas puras hardcodeadas bajo `work/`, nunca bajo `raw/`.
- `src/fs/` — puertos de I/O inyectables (`DirectoryReader`, `FileStatReader`, `WriteTextFile`,
  `EnsureDirectory`) y `guard-raw-writes.ts`, que hace de `raw/` solo-lectura por error tipado
  antes de tocar el filesystem.
- `src/catalog/` — schema Zod del catálogo (`CATALOG_SCHEMA_VERSION`) + `readCatalog` / `writeCatalog`.
- `src/ingest/` — `classify-entry`, `discover-assets`, `probe-assets`, `transcription-key`,
  `plan-ingest-work`, `transcribe-assets` e `ingest-project` (composición end-to-end).
- `src/presets/` — `MontagePreset`, los 4 presets (`software-demo`, `hardware`, `recipe`,
  `educational`) y `preset-registry.ts` (`MONTAGE_PRESETS`, `resolveMontagePreset`: acepta nombre o
  preset completo, lanza `MontageInputError('unknown-preset')`). `ClipFit` se deriva localmente como
  `NonNullable<VideoClip['fit']>` porque no está en el barrel de `timeline-core`. Invariante con
  test: `punchIn.every >= 2` en los 4.
- `src/concepts/` — `normalizeTerm`, `resolveStopwords` (por idioma; degrada a lista vacía, nunca a
  español — D-16/A-5) y `spotConcepts` (greedy-longest-first sobre el diccionario del preset, con
  caída al camino de frecuencia).
- `src/broll/` — `assetTokens` (subcarpetas + nombre de archivo, D-14), `buildBrollIndex` (ordenado
  por `assetId`, independiente del orden del catálogo), `selectBrollAsset` (rol → especificidad →
  `assetId`) y `planBrollOverlays` (barrido cronológico → `overlays` + `rejections` tipadas).
- `src/montage/` — `pruneSilencesWithFrameMargin` (y el check `empty-aroll`, que corre **antes** de
  podar), `resolveMontageInputs`, `planCaptionGroups`, `planDuckRanges`, `planTransitions`,
  `keepWindow`, `buildEditDecisionList`, `assertValidEditDecisionList` / `assertValidTimeline`,
  `serializeMontageDocument` y los writers `writeEditDecisionList` / `writeTimeline`.
  `buildEditDecisionList` arma el único array `decisions` discriminado por `type`
  (`keep | cut | punch-in | transition | caption-group | duck`) que define `EditDecisionList` en
  `timeline-core` — no hay arrays separados por tipo (`keeps`, `punchIns`, ...); confirmado
  consumiendo la lib desde `tools/render-cli` (cycle-03 de spec-002).
- `src/errors/` — `AutoMontageError` como raíz + errores tipados con `code` estable:
  `CatalogUnreadableError`, `MontageInputError` (`MONTAGE_INPUT_INVALID`, con `reason`),
  `EditDecisionListInvalidError`, `TimelineInvalidError`.
- `src/transcript/` — `tokenizeScript` y `alignTranscriptToScript(words, scriptText)`: alinea la
  transcripción de Whisper contra un guion escrito por LCS sobre tokens normalizados. `autoMontage`
  lo aplica **antes** de podar silencios, así que captions/conceptos/ducking ven el mismo texto.
- `src/voice/` — fuente de verdad de `work/voice/voice.wav`, `work/voice/voice.words.json` y
  `work/voice/script-manifest.json` (`voice-script-paths.ts`, re-exportado por
  `apps/render-api` en vez de redefinido); `read-voice-script-track.ts` lee el manifest y sus
  palabras y devuelve `{ asset, transcription, manifestPath }` sin `stat`: el manifest es la prueba
  de existencia.
- `src/__fixtures__/` — árboles de proyecto y transcripciones de fixture.
- `src/smoke.ts` + target `smoke` (`nx run auto-montage:smoke`): único camino a I/O real, fuera de
  `lint test build` y de CI. Material regenerable documentado en el README (`media/smoke-ingest`).

## 4. Convenciones propias

- **Todo I/O entra por puertos inyectables**, igual que `media-local`: `CommandRunner` para binarios
  y puertos de filesystem para leer/escribir. Ningún módulo instancia I/O adentro. Es lo que hace
  que la suite corra sin binarios (RNF-3 de la spec).
- **`raw/` es de solo lectura por contrato**: cualquier escritura bajo `raw/` es un error tipado, no
  una convención de buena voluntad.
- **Rutas relativas a la raíz del proyecto de medios**, nunca absolutas: es lo que mantiene el render
  en la rama `staticFile()` verificada de `assetSrc` (D-2 de la spec).
  `ProjectRelativePathSchema` rechaza rutas absolutas (CA-003 / RN-05).
  `IngestResult.catalogPath` y `probeFailures[].path` ya vienen relativos al proyecto (los producen
  `catalogPath()` y `finding.relativePath`): no hay que relativizarlos de nuevo aguas abajo. La
  asimetría con `RenderOutcome.outPath` de `composition-remotion` (que sí es absoluto y hay que
  relativizar contra la raíz del proyecto) no es obvia para quien consume el barrel — confirmado
  construyendo `tools/render-cli` (cycle-03 de spec-002).
- **Determinismo**: sin `Date`, `process` ni `Math.random` en `src/` fuera de `smoke.ts`; el `seed`
  entra por parámetro. ESLint lo impone mecánicamente. Todo test que compare bytes entre dos
  corridas completas del pipeline debe inyectar un `Clock` fijo a `ingestProject` — si no, falso
  rojo. Un test de sensibilidad al seed debe mirar la cardinalidad del espacio de salida antes de
  elegir el par (`pickScale` tiene solo 2 valores en `software-demo`).
- **Los rechazos son datos, no silencio**: todo lo que el planificador descarta sale en
  `brollRejections` con motivo tipado (`no-candidate`, `punch-in-overlap`, `outside-keep`,
  `repeat-window`, `overlay-gap`, `coverage-cap`, `too-short`). No agregar descartes mudos.
- **El orden de claves de lo persistido lo fija el schema tras `.parse()`**, no el literal de
  construcción (D-18). Comparar contra `JSON.stringify(fixture)` crudo falla.
- **Idempotencia**: cada etapa se puede re-ejecutar; nada depende de un archivo de `work/` que no
  sepa regenerar desde `raw/`. El catálogo es función pura de (`raw/` + catálogo anterior) y una
  segunda corrida sin cambios produce un `catalog.json` idéntico byte a byte (D-6); no lleva
  `generatedAt` (D-7). Un catálogo anterior ilegible degrada a ingesta completa con
  `staleCatalogReplaced: true` (D-8).
- **`AssetRole` es un tipo suma de seis miembros** (`aroll`, `broll`, `music`, `image`, `voice`,
  `logo`): ensancharlo es un cambio global, todo `Record<AssetRole, …>` nuevo (en esta lib o en un
  consumidor) tiene que contemplar los seis. `raw/voice/` espera `MediaKind: 'audio'`; `raw/logo/`
  espera png/jpg/webp (`.svg` ⇒ `unsupported-extension`). `DEFAULT_TRANSCRIBE_ROLES` sigue siendo
  `['aroll']`: la ingesta no transcribe `raw/voice/` (lo hace el job `voice` de `apps/render-api`
  cuando se asocia a una escena).
- **`probeAssets` mide loudness de todo asset `audio`** (`measureLoudness` → `audio.integratedLufs`);
  una medición fallida no pierde el asset ni cuenta como `probeFailure`. `planIngestWork` **no
  reusa** una entrada de catálogo de rol `audio` sin esa medición (`isMissingLoudnessMeasurement`):
  un proyecto ya ingestado se re-mide solo, sin borrar `work/catalog.json`.
- **El estilo de captions lo resuelve el preset de montaje, no un default global**:
  `captionStyleForMontagePreset(presetName, requested)` sobre `CAPTION_STYLE_BY_MONTAGE_PRESET`
  (`educational → subtle-lower`, los otros tres → `bold-impact`); `AutoMontageOptions.captionStyle?`
  gana si se pasa explícito, y `AutoMontageResult.captionStyle` siempre lo publica resuelto. El
  estilo no cambia el preset de montaje: `educational` + `bold-impact` explícito es válido.
- **`autoMontage` tiene dos fuentes de habla** (`voice: 'aroll' | 'script'`, default `aroll`,
  byte a byte igual al comportamiento anterior): la transcripción del A-roll o la voz sintetizada
  por el job `voice`. `pruneSilencesWithFrameMargin` recibe `{ sourceDurationMs, prune }` en vez del
  `MediaAsset` del A-roll; `prune` default es `voice === 'aroll'`, forzable por
  `options.pruneSilences`. Un guion suelto pasa por `stripVoiceScriptTimeMarks` antes de
  `alignTranscriptToScript` — sin eso, `[0:00]` tokeniza como palabras y contamina la primera
  caption.
- **La duración del montaje en modo `script` depende de si el guion es cronometrado**: con marcas de
  tiempo dura el A-roll completo (la narración termina antes, la cola queda muda, `truncatedMs` se
  calcula contra `narrationEndMs`); sin marcas es `min(voz, A-roll)` con `truncatedMs` clásico. El
  A-roll se transcribe igual en modo `script` — es trabajo de Whisper que nadie lee, pero cambiarlo
  es tocar `DEFAULT_TRANSCRIBE_ROLES`, no el modo de voz.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- Tags Nx: `scope:engine` + `type:feature` (D-1), con la regla
  `{ sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] }` en el
  `eslint.config.mjs` de la raíz.
- Targets explícitos como en `timeline-core`/`media-local`: `lint`, `test`
  (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json`); sin plugins
  inferidos en `nx.json`.
- `vite.config.ts` declara `resolve.alias` de `@video-maker/timeline-core` y
  `@video-maker/media-local`: `tsc` resuelve por `tsconfig.base.json → paths`, Vitest no.

## 5. Decisiones heredadas relevantes

- **D-5** — `assetId` === `asset.path` === ruta relativa POSIX del asset (validado por el schema).
- **D-6/D-7/D-8** — ver Idempotencia arriba.
- **D-4** — `ClipTransform.anchor` (cambio aditivo en `timeline-core`) llega hasta
  `work/timeline.json`; el cableado al render (`punchInStyle` en `composition-remotion`) se
  completó en cycle-03 (`aroll-series.tsx` de `composition-remotion`, fuera de esta lib).
- La clave de invalidación de transcripción incluye el modelo de whisper y el idioma solicitado.
- `ignored[]` tiene 5 motivos; `extension-role-mismatch` compara extensión contra **rol de carpeta**,
  no el `MediaKind` sondeado.
- **RN-07 / RN-14** — transcripción y render nunca en paralelo (16 GB de RAM compartidos).
- Binarios externos (solo en el smoke): `ffmpeg`, `ffprobe`, `whisper-cli` + modelo `ggml-*.bin`,
  resueltos por `media-local` desde `.env`. La lib nunca lee `process.env` (ESLint lo prohíbe salvo
  en `src/smoke.ts`).
- **`resolveBinaries(env)` de `media-local` es asíncrona** (`=> Promise<ResolvedBinaries>`), aunque
  parte de la documentación de la spec la anota como si devolviera el objeto directo — quien la
  consuma desde acá o desde un consumidor de esta lib no debe asumir el valor sincrónico
  (confirmado construyendo `tools/render-cli` en cycle-03 de spec-002).
