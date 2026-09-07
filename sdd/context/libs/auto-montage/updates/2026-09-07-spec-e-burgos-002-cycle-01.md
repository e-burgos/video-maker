# spec-e-burgos-002 cycle-01 — 2026-09-07

## Estado

- `libs/auto-montage` existe y está operativa para la **fase de ingesta**: `ingestProject`
  descubre y clasifica `raw/`, sondea vía `probeMedia`, transcribe el A-roll con
  `transcribeWithWhisperCpp` de forma incremental y persiste `work/catalog.json`.
- `resuelve: constitution.md §1 "pendiente: la lib todavía no tiene código"` — el scaffold, la
  superficie pública (`src/index.ts`) y la jerarquía de errores tipados ya están.
- 19 archivos de test, 143 tests, cobertura 96,49 % statements / 85,25 % branches (umbral 85).
- CA-007 verificado con un smoke real sobre `media/smoke-ingest` (`media/` está gitignoreado; el
  README documenta cómo regenerar el proyecto de ejemplo con `say` + `ffmpeg`).
- Fuera de alcance y aún pendientes: keyword spotting, planificador de B-roll y armado de la
  `Timeline` (cycle-02 / cycle-03).

## Estructura

- `src/project/` — contrato `MediaProject` (`raw`/`work`/`out`) y álgebra de rutas
  (`toProjectRelativePath` / `toAbsolutePath`).
- `src/fs/` — puertos de I/O inyectables (`DirectoryReader`, `FileStatReader`, `WriteTextFile`,
  `EnsureDirectory`) y `guard-raw-writes.ts`, que hace de `raw/` solo-lectura por error tipado
  antes de tocar el filesystem.
- `src/catalog/` — schema Zod del catálogo (`CATALOG_SCHEMA_VERSION`) + `readCatalog`/`writeCatalog`.
- `src/ingest/` — `classify-entry`, `discover-assets`, `probe-assets`, `transcription-key`,
  `plan-ingest-work`, `transcribe-assets` e `ingest-project` (composición end-to-end).
- `src/errors/` — `AutoMontageError` como raíz + 6 errores tipados con `code` estable.
- `src/smoke.ts` + target `smoke` (`nx run auto-montage:smoke`): único camino a I/O real, fuera de
  `lint test build` y de CI.

### Decisiones aplicadas que el próximo ciclo hereda

- **D-5** — `assetId` === `asset.path` === ruta relativa POSIX del asset (validado por el schema).
- **D-6** — el fingerprint (`sizeBytes` + `modifiedAtMs`) invalida **el probe además de** la
  transcripción; el catálogo es una función pura de (`raw/` + catálogo anterior) y una segunda
  corrida sin cambios produce un `catalog.json` **idéntico byte a byte**.
- **D-7** — el catálogo **no** lleva `generatedAt` (corolario de D-6).
- **D-8** — un catálogo anterior ilegible no aborta: `readCatalog` devuelve `null` si el archivo no
  existe y lanza `CatalogUnreadableError` si existe pero es inválido; `ingestProject` lo captura y
  degrada a ingesta completa con `staleCatalogReplaced: true`.
- `ProjectRelativePathSchema` **rechaza rutas absolutas** (CA-003 / RN-05).
- `ignored[]` tiene 5 motivos, con `extension-role-mismatch` comparando **extensión contra rol de
  carpeta**, no el `MediaKind` sondeado.
- La clave de invalidación de transcripción incluye el **modelo de whisper y el idioma
  solicitado**: cambiar cualquiera de los dos re-transcribe.
- `discoverAssets` ordena las findings por ruta → salida determinista independiente del orden del
  filesystem.

## Dependencias

- **Cero dependencias npm nuevas** (D-9). La lib no tiene `package.json` propio: se consume por
  source vía el alias `@video-maker/auto-montage` de `tsconfig.base.json`.
- Depende por source de `@video-maker/timeline-core` y `@video-maker/media-local`. **No** importa
  `composition-remotion`, `remotion` ni React.
- Tag Nx `type:feature` (D-1). Requirió sumar la regla
  `{ sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] }` al
  `eslint.config.mjs` de la raíz.
- Binarios externos (solo en el smoke): `ffmpeg`, `ffprobe`, `whisper-cli` + modelo `ggml-*.bin`,
  resueltos por `media-local` desde `.env`. La lib nunca lee `process.env` (ESLint lo prohíbe
  salvo en `src/smoke.ts`).

## Qué sigue

- **cycle-02**: keyword spotting sobre los transcripts y planificador de B-roll. La decisión
  **D-4** (anchor del punch-in) quedó diferida a ese ciclo y sigue abierta.
- **cycle-03**: armado de la `Timeline` y cableado con `tools/render-cli`.
- La cobertura de branches (85,25 %) está apenas por encima del umbral 85: el próximo ciclo debe
  sumar tests de rama o el umbral empezará a fallar solo.
- RN-07 sigue vigente: transcripción y render nunca en paralelo (16 GB de RAM compartidos).
