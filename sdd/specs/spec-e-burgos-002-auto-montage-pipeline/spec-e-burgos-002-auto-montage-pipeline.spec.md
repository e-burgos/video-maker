# SPEC-e-burgos-002: Auto-Montage A-Roll / B-Roll Pipeline

> Estado: **in-progress** — detallada por el sdd-orchestrator al abrir `cycle-01` (2026-09-07),
> según lo previsto en el borrador ("se redacta en detalle cuando la spec anterior de la cadena
> cierre su último ciclo"). `spec-e-burgos-001` cerró sus 3 ciclos el 2026-09-07.

## Resumen Ejecutivo

Pipeline de montaje automático A-roll / B-roll: ingesta de una carpeta de clips crudos (probe + transcripción), poda de silencios sobre material real, extracción de conceptos clave de la locución y superposición de B-roll e imágenes por concepto, selección de transiciones (whip pan, slide, light leaks) según preset de caso de uso y una CLI headless (`tools/render-cli`) que va de carpeta de assets a MP4.

Donde `spec-001` entregó **piezas** (contratos, cálculos puros, wrappers, composición), esta spec
entrega el **pegamento**: la función que toma una carpeta de material real y produce una `Timeline`
válida sin intervención humana, y la CLI que la ejecuta punta a punta.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto (borrador original):** ingesta y catálogo local de assets, keyword spotting sobre
`Transcription`, planificador de B-roll, presets `software-demo | hardware | recipe | educational`,
CLI `ingest → edl → timeline → render`.

### Contrato de entrada: layout de `media/`

El pipeline no recibe rutas sueltas: recibe **un proyecto de medios**, una carpeta con estructura
fija. `media/` ya está en `.gitignore` (línea 49) — el material nunca entra al repo.

```
media/<project-slug>/
  raw/          ← material irreemplazable. El pipeline NUNCA escribe acá.
    aroll/      clips de cámara o pantalla con locución
    broll/      clips de apoyo sin voz
    images/     fotos y capturas de apoyo
    audio/      locución separada y música
  work/         ← todo lo regenerable: transcripciones, catalog.json, edl.json, timeline.json
  out/          ← renders finales
```

**Invariante de la separación (razón de ser del layout):** `rm -rf media/<slug>/work media/<slug>/out`
es una operación segura en cualquier momento, y el pipeline reconstruye todo desde `raw/`. Ningún
paso puede depender de un archivo de `work/` que no sepa regenerar.

## Evidencia y decisiones

> Sigue sin existir `harness.idea.md` en el repo: la evidencia es el brief de misión del dev
> (2026-09-07) y la sesión de diseño posterior al cierre de `spec-001`.

- Evidencia (sesión de diseño, 2026-09-07): el dev fija el layout de `media/<project-slug>/`
  con separación `raw` (nunca se escribe) / `work` (regenerable) / `out` (renders), y agrega
  `media/` al `.gitignore`.
- Evidencia (entorno verificado en la máquina del dev, 2026-09-07): `ffmpeg 9.0.1`, `ffprobe` y
  `whisper-cli` (Metal, `COREML=0`) en `/opt/homebrew/bin`; modelo
  `ggml-large-v3-turbo-q5_0.bin` (574.041.195 bytes) en `~/.cache/whisper-models/`; las 6 variables
  del proyecto en el `.env` raíz, que **Nx carga en el proceso de cada task** (verificado
  empíricamente). Consecuencia: la ingesta real con probe + transcripción es ejecutable en esta
  máquina — esta spec **no** mockea el pipeline entero.
- Evidencia (cierre de `cycle-03` de `spec-001`): `assetSrc` tiene dos ramas — path relativo →
  `staticFile()` (**verificada** con render real) y path absoluto → `file://` (**no verificada**,
  con riesgo de que Chrome bloquee sub-recursos). `RenderTimelineOptions.publicDir` se pasa derecho
  al `bundle()` de Remotion (`libs/composition-remotion/src/render.ts`).
- **Decisión cerrada (dev, 2026-09-07):** el catálogo y la `Timeline` guardan rutas **relativas a la
  raíz del proyecto de medios** (`raw/aroll/clip01.mp4`, `work/audio/voice-14lufs.wav`) y el render
  pasa `publicDir: media/<project-slug>` — la raíz del proyecto, **no** `raw/`. Cubre también los
  medios derivados que viven en `work/` y mantiene todo el material en la rama `staticFile()`
  verificada de `assetSrc`, sin copiar gigabytes a `public/`.
- **Decisión cerrada (dev, 2026-09-07):** `media/` es el store canónico en disco; el MinIO de
  `spec-005` es una **vista** que `render-api` expone sobre él, nunca un segundo lugar donde vivan
  los archivos. `spec-005` hereda esta decisión.
- Decisión heredada de `spec-001`: sin APIs externas pagas; todo local (FFmpeg, whisper.cpp,
  Remotion).

## Alcance

**Dentro de esta spec:**

1. **Proyecto de medios y catálogo:** descubrimiento y clasificación de los assets de
   `media/<slug>/raw/`, probe de cada uno vía `probeMedia`, transcripción del A-roll vía
   `transcribeWithWhisperCpp`, y persistencia del resultado en `work/` de forma incremental
   (no se re-transcribe lo que no cambió).
2. **Keyword spotting:** extracción de conceptos clave de la `Transcription` (sin modelos externos:
   frecuencia + stopwords + diccionario del preset), con timestamps.
3. **Planificador de B-roll:** matching de conceptos contra los assets de `broll/` e `images/` por
   nombre de archivo y metadatos, con reglas de duración mínima/máxima, no-repetición y no-solape
   con los punch-ins.
4. **Presets por caso de uso** (`software-demo | hardware | recipe | educational`): parámetros de
   poda, punch-in, transiciones, densidad de B-roll y vocabulario de conceptos.
5. **Orquestación:** función única `autoMontage(project, preset)` que compone los cálculos de
   `timeline-core` (`pruneSilences`, `planPunchIns`, `groupWordsForCaptions`, `planDucking`,
   `buildTimeline`) en una `EditDecisionList` y una `Timeline` validada.
6. **CLI headless `tools/render-cli`:** `ingest`, `plan`, `render` (y `run` como atajo de los tres),
   de carpeta de assets a MP4 en `out/`.

**Fuera de esta spec:**

- Componente visual de kinetic typography → `spec-e-burgos-003-kinetic-captions` (esta spec produce
  los `CaptionGroup`, no su estilo).
- Mezcla final multi-pista y mastering → `spec-e-burgos-004-audio-mix-mastering` (esta spec produce
  el `AudioMixPlan`; el mux real es de 004).
- API, cola de jobs y MinIO → `spec-e-burgos-005-render-service`.
- UI → `spec-e-burgos-006-web-studio`.
- **Matching semántico con embeddings o LLM.** El matching de esta spec es léxico y determinista;
  cualquier cosa que requiera un modelo se evalúa en una spec posterior.

## Arquitectura

### Subproyectos nuevos

| Subproyecto         | Tipo                 | Rol                                                                                   |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `libs/auto-montage` | lib Node TS          | Ingesta, catálogo, keyword spotting, planificador de B-roll, presets, `autoMontage()`  |
| `tools/render-cli`  | tool Node ejecutable | CLI headless que orquesta `auto-montage` + `composition-remotion/render`               |

`libs/auto-montage` es la primera lib del repo que depende **a la vez** de `type:domain`
(`timeline-core`) y `type:util` (`media-local`): las boundaries Nx del `eslint.config.mjs` raíz hoy
no tienen un tag que lo permita. Definirlo es tarea del arquitecto de `cycle-01` (ver D-1).

### Etapas del pipeline

```
media/<slug>/raw/  --ingest-->  MediaProject + Transcription   (work/catalog.json, work/transcripts/)
                   --plan---->  EditDecisionList + Timeline    (work/edl.json, work/timeline.json)
                   --render-->  MP4                            (out/)
```

Cada etapa lee lo que la anterior dejó en `work/` y es re-ejecutable de forma idempotente.

## Dependencias

- **Módulos previos:** `spec-e-burgos-001-core-composition-media-pipeline` (`completed`, 3 ciclos).
  Consume `@video-maker/timeline-core`, `@video-maker/media-local` y
  `@video-maker/composition-remotion/render`.
- **Binarios locales:** los mismos de `spec-001` (`ffmpeg`, `ffprobe`, `whisper-cli` + modelo
  `ggml-*`), resueltos por `resolveBinaries()` desde el `.env` raíz. Ya instalados y verificados en
  la máquina del dev.
- **Paquetes npm nuevos previstos:** un parser de argumentos para la CLI (`node:util parseArgs` si
  alcanza — preferido, cero dependencias). El arquitecto decide y justifica.

## Requisitos Funcionales (RF)

- RF-1: El sistema descubre los assets de `media/<slug>/raw/` y los clasifica en `aroll`, `broll`,
  `images` y `audio` por su subcarpeta, ignorando archivos ocultos y extensiones no soportadas.
- RF-2: Cada asset descubierto se sondea con `probeMedia` y queda en el catálogo como `MediaAsset`
  válido contra su schema; un asset ilegible se reporta con su ruta y no aborta la ingesta del resto.
- RF-3: El A-roll se transcribe con `transcribeWithWhisperCpp` y el resultado se persiste en
  `work/transcripts/`; una segunda corrida sobre material sin cambios **no** vuelve a transcribir.
- RF-4: El catálogo (`work/catalog.json`) guarda rutas relativas a la raíz del proyecto de medios,
  nunca absolutas.
- RF-5: El sistema extrae conceptos clave de la `Transcription` con sus rangos temporales, de forma
  determinista y sin modelos externos.
- RF-6: El planificador asocia cada concepto con a lo sumo un asset de `broll/` o `images/`,
  respetando duración mínima y máxima del preset, sin repetir un asset dentro de una ventana
  configurable y sin solaparse con un punch-in.
- RF-7: Existen los 4 presets (`software-demo`, `hardware`, `recipe`, `educational`), cada uno con
  sus parámetros de poda, punch-in, transiciones y densidad de B-roll.
- RF-8: `autoMontage(project, preset)` produce una `EditDecisionList` válida y una `Timeline` que
  pasa `validateTimeline` sin issues, a partir de un proyecto de medios ingerido.
- RF-9: El pipeline es determinista: mismo proyecto + mismo preset + mismo `seed` → misma `Timeline`
  byte a byte.
- RF-10: La CLI expone `ingest`, `plan` y `render` sobre un proyecto de medios, más `run` que
  encadena los tres, y devuelve exit code distinto de 0 ante cualquier fallo.
- RF-11: El `render` de la CLI invoca `renderTimeline` con `publicDir` apuntando a la raíz del
  proyecto de medios y escribe el MP4 en `out/`.
- RF-12: Borrar `work/` y `out/` y volver a correr `run` reproduce el mismo MP4 sin tocar `raw/`.

## Requisitos No-Funcionales (RNF)

- RNF-1: TypeScript `strict`, cero `any`, cero comentarios narrativos; ESM.
- RNF-2: Cobertura Vitest ≥ 85% líneas en la lógica pura de `libs/auto-montage`.
- RNF-3: **La suite corre sin ffmpeg, whisper ni Chrome instalados.** Todo I/O entra por puertos
  inyectables (`CommandRunner`, y un puerto de filesystem análogo), igual que en `media-local`.
- RNF-4: Determinismo — ningún cálculo lee reloj, entorno ni aleatoriedad sin `seed`.
- RNF-5: El pipeline nunca escribe dentro de `raw/`; un intento de hacerlo es un error tipado.
- RNF-6: Cada subproyecto expone su API solo desde su entry point; `enforce-module-boundaries` en verde.
- RNF-7: Los errores de la CLI identifican la etapa, el asset y la causa; nunca un stack pelado.
- RNF-8: `pnpm sdd:validate && pnpm exec nx run-many -t lint test build` en verde al cierre de cada ciclo.

## Criterios de Aceptación

> Numeración continua a nivel spec (como en `spec-001`). Ningún CA automatizado invoca binarios;
> los CA de verificación real son smoke manuales documentados, fuera de CI.

| CA     | Criterio verificable                                                                                                                        | Ciclo      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CA-001 | Un árbol `raw/` de fixture con `aroll/`, `broll/`, `images/`, `audio/`, un archivo oculto y una extensión no soportada → catálogo con los assets esperados y los dos ignorados reportados | `cycle-01` |
| CA-002 | Un asset cuyo probe falla no aborta la ingesta: el catálogo trae el resto y un error con la ruta del fallido                                 | `cycle-01` |
| CA-003 | El catálogo serializado guarda rutas relativas a la raíz del proyecto; ninguna empieza con `/`                                                | `cycle-01` |
| CA-004 | Segunda ingesta sobre un proyecto sin cambios → cero invocaciones a `whisper-cli` (verificado con `FixtureCommandRunner`)                     | `cycle-01` |
| CA-005 | Un cambio en el A-roll (tamaño/mtime) invalida su transcripción y la vuelve a pedir                                                          | `cycle-01` |
| CA-006 | Escribir en `raw/` desde cualquier etapa → error tipado, sin efecto en el filesystem                                                          | `cycle-01` |
| CA-007 | Smoke manual: ingesta real de un proyecto en `media/` con los binarios instalados → `catalog.json` + transcripción coherentes                 | `cycle-01` |
| CA-008 | Keyword spotting sobre una `Transcription` de fixture → conceptos esperados con sus rangos; dos corridas idénticas                            | `cycle-02` |
| CA-009 | El planificador no asigna dos veces el mismo B-roll dentro de la ventana del preset ni lo solapa con un punch-in                              | `cycle-02` |
| CA-010 | Los 4 presets existen y cada uno produce parámetros distintos sobre el mismo proyecto de fixture                                             | `cycle-02` |
| CA-011 | `autoMontage` sobre el proyecto de fixture → `Timeline` con `validateTimeline` sin issues                                                     | `cycle-02` |
| CA-012 | Mismo proyecto + mismo preset + mismo `seed`, dos corridas → `timeline.json` byte a byte idéntico                                             | `cycle-02` |
| CA-013 | `ingest`, `plan`, `render` y `run` existen, validan sus argumentos y devuelven exit code ≠ 0 ante error                                       | `cycle-03` |
| CA-014 | `render` invoca `renderTimeline` con `publicDir` = raíz del proyecto y `outPath` dentro de `out/`                                             | `cycle-03` |
| CA-015 | Smoke manual end-to-end: `run` sobre un proyecto real produce un MP4 reproducible con las dimensiones del formato                             | `cycle-03` |
| CA-016 | Borrar `work/` y `out/` y repetir `run` → mismo MP4, `raw/` intacto                                                                           | `cycle-03` |

## Ciclos planificados

| Ciclo      | Subproyecto         | Alcance                                                                                                          | Definition of Done                                      |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `cycle-01` | `libs/auto-montage` | Scaffold (`scaffold-nx`), contrato del proyecto de medios (`media/<slug>/`), descubrimiento + clasificación, probe, transcripción incremental, catálogo persistido | CA-001 → CA-007, contexto del subproyecto creado |
| `cycle-02` | `libs/auto-montage` | Keyword spotting, planificador de B-roll, los 4 presets, `autoMontage()` → EDL + Timeline                          | CA-008 → CA-012                                         |
| `cycle-03` | `tools/render-cli`  | CLI `ingest`/`plan`/`render`/`run`, `publicDir`, salida a `out/`, smoke end-to-end                                 | CA-013 → CA-016                                         |

Los tres ciclos son secuenciales (un ciclo activo por spec). Cada uno cierra con
`pnpm sdd:validate && pnpm exec nx run-many -t lint test build` en verde y su fragmento aditivo de
contexto en `updates/`.

## Riesgos y decisiones abiertas

- **D-1 — Tag Nx de `libs/auto-montage` (decide el arquitecto en `cycle-01`).** Es la primera lib que
  necesita depender de `type:domain` **y** `type:util` a la vez. Las boundaries actuales del
  `eslint.config.mjs` raíz (`type:domain` → `[]`, `type:util` → `['type:domain']`,
  `type:ui` → `['type:domain']`) no lo contemplan. Requiere un tag nuevo — el cambio es en config
  raíz y afecta a todo el repo.
- **D-2 — RESUELTA (dev, 2026-09-07).** `publicDir: media/<project-slug>` (raíz del proyecto) y
  rutas del catálogo relativas a esa raíz. Se descartó `publicDir: media/<slug>/raw` porque los
  medios **derivados** (voz normalizada a −14 LUFS de `spec-004`, audio extraído para transcribir)
  viven en `work/` y habrían quedado fuera, cayendo en la rama `file://` no verificada de
  `assetSrc`. Vinculante para el formato de rutas que escribe el catálogo de `cycle-01`.
- **D-3 — RESUELTA (dev, 2026-09-07).** `media/` es el store canónico en disco; MinIO es la vista
  que `render-api` expone sobre él. `spec-005` la hereda.
- **D-4 — `anchor` del punch-in.** `cycle-03` de `spec-001` dejó anotado que el `anchor` no viaja en
  la `Timeline` y que "corresponde a `spec-002` extender el contrato". Extender un contrato de
  `timeline-core` desde esta spec toca una lib de otra spec ya cerrada: el arquitecto de `cycle-02`
  decide si se extiende el contrato o si el preset fija el anchor sin persistirlo.
- **Matching léxico:** el keyword spotting sin modelo puede errarle en material con vocabulario
  ambiguo. Mitigación: diccionario de conceptos por preset y B-roll nombrado por concepto. Si
  resulta insuficiente en uso real, se evalúa una spec posterior con embeddings locales.
- **Memoria:** vale la regla operativa de `spec-001` — transcribir **antes** de renderizar, nunca en
  paralelo (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper).
