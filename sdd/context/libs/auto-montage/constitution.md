# Constitución — libs/auto-montage

> Versión 1.1 | Última actualización: cycle-02 | Fecha: 2026-09-07
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
- `src/errors/` — `AutoMontageError` como raíz + errores tipados con `code` estable:
  `CatalogUnreadableError`, `MontageInputError` (`MONTAGE_INPUT_INVALID`, con `reason`),
  `EditDecisionListInvalidError`, `TimelineInvalidError`.
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
  `work/timeline.json`; el cableado al render (`punchInStyle` en `composition-remotion`) es de
  `cycle-03`.
- La clave de invalidación de transcripción incluye el modelo de whisper y el idioma solicitado.
- `ignored[]` tiene 5 motivos; `extension-role-mismatch` compara extensión contra **rol de carpeta**,
  no el `MediaKind` sondeado.
- **RN-07 / RN-14** — transcripción y render nunca en paralelo (16 GB de RAM compartidos).
- Binarios externos (solo en el smoke): `ffmpeg`, `ffprobe`, `whisper-cli` + modelo `ggml-*.bin`,
  resueltos por `media-local` desde `.env`. La lib nunca lee `process.env` (ESLint lo prohíbe salvo
  en `src/smoke.ts`).
