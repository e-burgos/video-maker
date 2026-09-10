# auto-montage

Lib Node que ingiere un **proyecto de medios** (`media/<project-slug>/`) y arma el **auto-montaje**
sobre ese material: descubre y clasifica el crudo en `raw/`, lo sondea con `probeMedia` de
`media-local`, transcribe el A-roll con `transcribeWithWhisperCpp` de forma incremental y persiste
todo en `work/catalog.json` (cycle-01) — y, sobre ese catálogo ya ingerido, `autoMontage` poda
silencios, detecta conceptos clave en la locución, elige B-roll por matching léxico contra el
nombre de archivo, arma captions y ducking, y produce un `EditDecisionList`/`Timeline` válidos que
persiste en `work/edl.json`/`work/timeline.json` (cycle-02). Todas las rutas son siempre relativas
a la raíz del proyecto. Sin base de datos, sin endpoints HTTP, sin UI.

Se importa por source vía el alias `@video-maker/auto-montage`.

## Límites de la lib

- **`raw/` es de solo lectura por contrato.** Cualquier intento de escritura ahí, desde cualquier
  etapa, es un error tipado (`ReadOnlyRawPathError`) antes de tocar el filesystem — nunca una
  convención de buena voluntad.
- **Todo I/O entra por puertos inyectables** (`CommandRunner`, `DirectoryReader`, `FileStatReader`,
  `ReadTextFile`, `WriteTextFile`, `EnsureDirectory`, `Clock`). Ningún test de `*.spec.ts` toca un
  binario real ni el filesystem real: el único camino a I/O real es el target `smoke`, manual y
  fuera de `lint test build`.
- **Roles del crudo: `aroll`, `broll`, `image`, `audio`, `voice` y `logo`.** `raw/logo/` acepta
  png/jpg/webp (un `.mp4` ahí es `extension-role-mismatch`; un `.svg`, `unsupported-extension`).
  Si el proyecto tiene un logo, `autoMontage` lo incorpora a `timeline.logo` con los defaults del
  schema (abajo a la derecha); `logo: 'off'` lo omite.
- **El ingest mide el loudness de los assets de rol `audio` (spec-014).** Tras el `ffprobe`,
  `probeAssets` corre `measureLoudness` y guarda `asset.audio.integratedLufs` en el catálogo: es la
  única medición de la que dependen el grafo del mix de `media-local` y el `<Audio>` de Remotion
  para normalizar la cama. Un catálogo previo cuyo asset de audio no la trae **no se reusa**, así
  que los proyectos ya ingestados se actualizan solos. Una medición fallida no pierde el asset ni
  cuenta como `probeFailure`.
- **Los niveles de música los fija el preset y llegan a la Timeline.** `preset.audio` viaja como
  `MusicInput.mix` a `buildTimeline`, que antes hardcodeaba `DEFAULT_MUSIC_MIX`: sin ese cable,
  cambiar un preset era un no-op porque el consumidor real es `audioMix.automation`.
- **Las captions se pueden alinear al guion (spec-014).** `alignTranscriptToScript(words,
  scriptText)` alinea por LCS sobre tokens normalizados (sin tildes ni puntuación) y **reemplaza el
  texto** de las palabras mal oídas por el del guion **conservando los tiempos de Whisper**. Un
  bloque de diferencia es un run de *n* palabras de Whisper contra *k* del guion: con `n ≥ 1` el
  span `[inicio de la primera, fin de la última]` se reparte en *k* tramos iguales (cubre `Ven y →
  Vení` y `sinembargo → sin embargo`); con `n = 0` las *k* palabras entran en el hueco vecino sólo
  si mide al menos *k* ms y si no **se descartan** (`dropped`); con `k = 0` las palabras de Whisper
  se eliminan. `autoMontage` lo aplica antes de podar silencios, así que captions, conceptos y
  ducking ven el mismo texto; los `segments` de la transcripción se vacían porque sus `wordRange`
  dejan de ser válidos.
- **No renderiza.** `auto-montage` no importa `@video-maker/composition-remotion`, `remotion` ni
  React — quien cablea el motor con el render es `tools/render-cli` (`cycle-03`).
- `discoverAssets`, `probeAssets`, `transcribeAssets`, `planIngestWork`, `buildTranscriptionKey`,
  el álgebra de `project/project-paths.ts`, los guards de `fs/guard-raw-writes.ts`,
  `spotConcepts`/`normalizeTerm`/`resolveStopwords`, `assetTokens`/`buildBrollIndex`/
  `selectBrollAsset`/`planBrollOverlays`, `planTransitions`/`planCaptionGroups`/`planDuckRanges`,
  `buildEditDecisionList`, `findEnclosingKeep`, los dos `assertValid*` y todo `src/__fixtures__/`
  son detalle de implementación: no se exportan desde `src/index.ts`.
- **El auto-montaje es determinista por `seed`.** La única fuente de azar de todo el pipeline es
  el `mulberry32` que siembra `planPunchIns`; keyword spotting, matching de B-roll, transiciones y
  ducking son funciones totales sin azar (D-13).

## API pública

Todo lo exportado vive en `src/index.ts` (firmas completas en `architect.md` §7/§8 de cycle-01 y
§9 de cycle-02).

| Área | Exports principales |
| --- | --- |
| Proyecto de medios | `resolveMediaProject`, tipo `MediaProject` |
| Catálogo (schema Zod) | `CatalogSchema`, `CatalogAssetSchema`, `AssetFingerprintSchema`, `AssetRoleSchema`, `IgnoredEntrySchema`, `ProbeFailureSchema`, `ProjectRelativePathSchema`, `TranscriptRefSchema`, `CATALOG_SCHEMA_VERSION`, y los tipos derivados |
| Persistencia del catálogo | `readCatalog`, `writeCatalog` |
| Ingesta end-to-end | `ingestProject`, tipos `IngestOptions`, `IngestDependencies`, `IngestResult` |
| Auto-montaje end-to-end | `autoMontage`, tipos `AutoMontageOptions`, `AutoMontageResult`, `MontageDependencies` |
| Presets editoriales | `MONTAGE_PRESETS`, `resolveMontagePreset`, tipos `MontagePreset`, `MontagePresetName`, `BrollRolePriority` |
| Conceptos y B-roll (resultado) | Tipos `Concept`, `ConceptOccurrence`, `BrollOverlayPlan`, `BrollRejection`, `BrollRejectionReason` |
| Persistencia del montaje | `serializeMontageDocument`, `writeEditDecisionList`, `writeTimeline` |
| Errores tipados | `AutoMontageError`, `isAutoMontageError`, `AssetProbeFailedError`, `CatalogUnreadableError`, `PathEscapesProjectError`, `ProjectLayoutError`, `ReadOnlyRawPathError`, `TranscriptionFailedError`, `MontageInputError` (+ tipo `MontageInputReason`), `EditDecisionListInvalidError`, `TimelineInvalidError` |
| Puertos de filesystem | `nodeDirectoryReader`, `nodeFileStatReader`, `nodeWriteTextFile`, `nodeEnsureDirectory`, y sus tipos |

`autoMontage(project, options, deps?)` recibe el `MediaProject` ya resuelto, un `options.preset`
(nombre de uno de los cuatro presets o un `MontagePreset` completo) y un `seed`; lee
`work/catalog.json` y la transcripción del A-roll elegido (con degradación a transcripción vacía
si falta o no parsea — nunca lanza por eso), compone el EDL y la Timeline, y — salvo
`options.persist === false` — persiste ambos en `work/edl.json`/`work/timeline.json`. Es lo que
`tools/render-cli` va a consumir en `cycle-03`.

Los tests nunca importan desde el barrel: cada uno prueba su módulo por ruta relativa, mismo
criterio que `timeline-core` y `media-local`. La excepción es `src/end-to-end.spec.ts`, que
ejercita a propósito el camino público completo (`resolveMediaProject` → `ingestProject` →
`autoMontage`) con puertos fake, para probar que las dos etapas encastran.

## Comandos

```bash
pnpm nx lint auto-montage
pnpm nx test auto-montage    # --coverage, umbral 85%
pnpm nx build auto-montage   # tsc -p tsconfig.lib.json — typecheck + .d.ts, sin bundler
```

## Variables de entorno (binarios locales, resueltas por `media-local`)

`ingestProject` recibe `opts.binaries: ResolvedBinaries` **ya resuelto** — la lib nunca lee
`process.env` (ESLint lo prohíbe salvo en `src/smoke.ts`). Quien resuelve el entorno es el
llamador: el target `smoke` de acá, o `tools/render-cli` en `cycle-03`.

| Variable | Binario que resuelve |
| --- | --- |
| `FFMPEG_PATH` | `ffmpeg` (extracción de audio para transcribir) |
| `FFPROBE_PATH` | `ffprobe` (sondeo de duración/formato) |
| `WHISPER_CPP_PATH` | `whisper-cli` (transcripción) |
| `WHISPER_MODEL_PATH` | modelo `ggml-*.bin` (sin fallback a `PATH`: un modelo no es ejecutable) |

Ver `libs/media-local/README.md` para la matriz completa de instalación en macOS. `Nx` carga
`.env` de la raíz del repo automáticamente en el proceso de cada target — por eso el smoke corre
como `pnpm nx run auto-montage:smoke`, nunca como `node ./src/smoke.ts` suelto.

## Generar un proyecto de medios de ejemplo (requiere `ffmpeg`)

`media/` está gitignoreado: nada de esto se commitea. Desde la **raíz del repo**:

```bash
mkdir -p media/smoke-ingest/raw/{aroll,broll,images,audio}

# A-roll con voz real (macOS): `say` + ffmpeg arma el mp4 sobre un fondo de color sólido.
# Es una comodidad de la plataforma — con material propio del dev (un clip con locución real)
# el smoke funciona exactamente igual; `say` solo evita depender de un archivo externo.
say -o /tmp/aroll-voice.aiff "Hola, esto es una prueba de ingesta del pipeline de auto montaje."
ffmpeg -y -f lavfi -i "color=c=0x224488:size=1280x720:rate=30" -i /tmp/aroll-voice.aiff \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 1 -ar 16000 \
  media/smoke-ingest/raw/aroll/clip01.mp4

# B-roll sintético (sin voz)
ffmpeg -y -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=5" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=5" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 2 \
  media/smoke-ingest/raw/broll/clip01.mp4

# Imagen sintética
ffmpeg -y -f lavfi -i "color=c=0x882244:size=1280x720" -frames:v 1 \
  media/smoke-ingest/raw/images/photo01.jpg

# Música de fondo sintética
ffmpeg -y -f lavfi -i "sine=frequency=220:sample_rate=44100:duration=8" \
  -c:a libmp3lame -ac 2 \
  media/smoke-ingest/raw/audio/music01.mp3

# Un archivo oculto y uno de extensión no soportada, para ejercitar `ignored[]`
touch media/smoke-ingest/raw/aroll/.DS_Store
echo "notas del dev, no es un asset" > media/smoke-ingest/raw/broll/notes.txt
```

## Smoke manual — CA-007 (fuera de CI)

`ingestProject` invocando binarios reales **nunca** corre en CI: ningún `*.spec.ts` de esta lib
invoca `ffmpeg`, `ffprobe` ni `whisper-cli` reales (RNF-3) — todos inyectan `FixtureCommandRunner`
o dobles del puerto de filesystem. El único camino a una ingesta real es este procedimiento,
manual:

1. Generar el proyecto de ejemplo con los comandos de arriba (o apuntar a un proyecto real propio
   del dev en `media/<project-slug>/raw/`).
2. **Terminar cualquier render antes de transcribir, nunca en paralelo** (RN-07, heredada de
   `spec-001`): en una máquina de 16 GB, Chrome Headless Shell (render de `composition-remotion`),
   `ffmpeg` y el modelo de Whisper cargados a la vez agotan la memoria compartida.
3. Correr el smoke:
   ```bash
   pnpm nx run auto-montage:smoke -- "$(pwd)/media/smoke-ingest"
   ```
   El argumento es la ruta **absoluta** al proyecto de medios (`$(pwd)` se evalúa en el shell del
   dev, antes de que Nx cambie el `cwd` a `libs/auto-montage` para correr el target). La primera
   corrida tarda varios segundos: el modelo `ggml-large-v3-turbo-q5_0.bin` pesa ~550 MB y
   transcribir, aunque sea un clip corto, no es instantáneo — es esperable, no interrumpir.
4. Verificar el resultado impreso por consola y `work/catalog.json`:
   - Ninguna ruta del catálogo empieza con `/` — todas relativas a la raíz del proyecto.
   - La transcripción del A-roll (`work/transcripts/aroll/clip01.json`) tiene texto coherente con
     lo que dice el audio.
   - `raw/.DS_Store` aparece en `ignored[]` con `reason: "hidden"`, y `raw/broll/notes.txt` con
     `reason: "unsupported-extension"`.
5. **Segunda corrida inmediata sobre el mismo proyecto** (CA-004 / D-6, sobre binarios reales):
   ```bash
   pnpm nx run auto-montage:smoke -- "$(pwd)/media/smoke-ingest"
   ```
   Verificar `transcribedAssetIds: []`, `reusedTranscriptionAssetIds` y `reusedProbeAssetIds` con
   el A-roll, y que la corrida termina en una fracción del tiempo de la primera (no hay invocación
   nueva a `whisper-cli` ni a `ffprobe`). Comparar el `catalog.json` de ambas corridas:
   ```bash
   shasum media/smoke-ingest/work/catalog.json   # correr antes y después, o guardar una copia
   diff catalog-primera-corrida.json media/smoke-ingest/work/catalog.json   # sin diferencias
   ```
6. `raw/` queda intacto: comparar los `shasum` de los archivos de `raw/` antes y después de las dos
   corridas — deben ser idénticos.

### Resultado de referencia (corrida real, 2026-09-07, Apple Silicon)

Primera corrida (~9,4 s): 4 assets catalogados (`aroll`/`broll`/`image`/`audio`), 2 ignorados
(`hidden`, `unsupported-extension`), 1 transcripción nueva. Texto transcripto del A-roll:
`"Hola, esto es una prueba de ingesta del pipeline, de automontage."` — coherente con el audio
generado por `say`. Segunda corrida (~1,2 s): `transcribedAssetIds: []`,
`reusedTranscriptionAssetIds: ["raw/aroll/clip01.mp4"]`, `reusedProbeAssetIds` con los 4 assets,
`catalog.json` idéntico byte a byte (mismo `shasum`) entre ambas corridas, `raw/` sin cambios.
