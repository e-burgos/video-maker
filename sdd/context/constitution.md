# Constitución del Proyecto

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Es la única fuente de verdad — este documento nunca los hardcodea, así `sdd/` se copia
> a otro repo sin editarlo. `pnpm sdd:validate` falla si el nombre se filtra acá.
> Versión 1.0 | Metodología: SDD (Spec-Driven Development) | Última actualización: cycle-0 (inicial)
> Este documento representa la base institucional, tecnológica y metodológica del proyecto.
> **PLANTILLA:** completar las secciones marcadas con `[...]` al inicializar el proyecto.

---

## 1. Resumen Ejecutivo y Visión

### 1.1 Propósito del Sistema

- **Nombre:** ver `sdd/global.json` → `project`
- **Rol arquitectónico:** motor local y autónomo de edición/postproducción de video para redes sociales (Reels/TikTok 9:16 y YouTube 16:9). Recibe material real (clips de cámara o pantalla, fotos de apoyo, locución y música), lo describe como datos (`Timeline` + `EditDecisionList`), calcula la edición (poda de silencios, punch-ins, captions, ducking) y la materializa con FFmpeg, Whisper local y Remotion. Sirve al creador que opera el sistema en su propia máquina, sin costo por minuto ni salida del material a la nube.
- **Descripción:** ver `sdd/global.json` → `description`

### 1.2 Responsabilidades del Sistema

**Sí hacemos:**

- Representar cualquier video de salida como un documento de datos validable contra JSON Schema.
- Calcular las decisiones de edición de forma determinista y testeable sin renderizar.
- Sondear, transcribir, normalizar y renderizar con herramientas 100% locales (FFmpeg, whisper.cpp, Remotion).
- Ofrecer previsualización, gestión de assets y disparo de renders locales desde una UI web.

**No hacemos:**

- No dependemos de APIs externas pagas (transcripción, IA generativa, render en la nube).
- No subimos material del usuario a servicios de terceros; el almacenamiento es local (filesystem / MinIO en dev).
- No somos un editor no-lineal genérico: cubrimos los cuatro casos de uso declarados en la spec 001.

### 1.3 Principios de Diseño

1. Motor declarativo: la edición es un documento (`Timeline`), nunca código imperativo por video.
2. Determinismo: misma entrada y mismo `seed` producen la misma salida; ningún cálculo lee reloj, entorno ni aleatoriedad.
3. Contrato conservador: toda entrada externa (ffprobe, Whisper, timelines guardadas) se valida con Zod y se rechaza con error tipado; nunca se completa con valores inventados.
4. Sin binarios en CI: los wrappers reciben un runner inyectable y los tests usan fixtures grabadas.
5. Unidades explícitas: milisegundos en el dominio de medios, frames en la timeline, una sola función de conversión.

### 1.4 Objetivos de Desarrollo

- Establecer un proceso de desarrollo guiado por especificaciones (SDD) robusto y de calidad.
- Garantizar que todo cambio pase por una fase de diseño funcional, de planificación y de arquitectura antes de codificar.
- Mantener un contrato de API coherente, versionado y documentado.

---

## 2. Arquitectura del Sistema

### 2.1 Estructura General

El sistema está organizado como un monorepo administrado con Nx.
Para el detalle técnico de cada subproyecto, ver su constitución específica:

| Subproyecto | Tipo | Rol en el sistema | Constitución específica |
| ----------- | ---- | ----------------- | ----------------------- |
| `libs/timeline-core` | lib de dominio TS | Contratos de datos del motor de video y cálculos puros de edición | `sdd/context/libs/timeline-core/constitution.md` |
| `libs/media-local` | lib Node TS | Wrappers de ffprobe/ffmpeg/whisper-cli/piper y parsers hacia los contratos del motor | `sdd/context/libs/media-local/constitution.md` |
| `libs/composition-remotion` | lib React + Remotion | Renderiza una Timeline en frames: pistas, transiciones, captions y render headless | `sdd/context/libs/composition-remotion/constitution.md` |
| `libs/auto-montage` | lib Node TS | Ingesta de un proyecto de medios, keyword spotting, planificador de B-roll y armado automático de la Timeline | `sdd/context/libs/auto-montage/constitution.md` |
| `libs/producer-tools` | lib Node TS | Herramientas del productor conversacional: contrato tipado de 14 tools, handlers sobre render-api, servidor MCP stdio acotado a un proyecto y prompt del productor | `sdd/context/libs/producer-tools/constitution.md` |
| `libs/local-store` | lib Node TS (nativa) | Base SQLite del estudio: migraciones versionadas y repositorios de proyectos, organización, conversaciones del productor, jobs y configuración | `sdd/context/libs/local-store/constitution.md` |
| `tools/render-cli` | tool Node ejecutable | CLI headless: de carpeta de assets a MP4, con la misma mezcla masterizada que la API | `sdd/context/tools/render-cli/constitution.md` |
| `apps/render-api` | app Node (servicio HTTP local) | Puerta HTTP del motor: orquesta render mudo → mezcla → mux → verificación de loudness en una sola llamada, la cola de jobs de render, montaje, storyboard y voz, y el productor conversacional (agente Claude Code headless, fuera de la cola) | `sdd/context/apps/render-api/constitution.md` |
| `apps/web` | app React 19 (SPA local) | Web Studio: **chat del productor como punto de partida del proyecto**, biblioteca de assets, generación del montaje con presets legibles, storyboard generativo editable con su hoja de prompts, voz en off por escena con reproducción y regeneración selectiva, preview de la Timeline con capa de logo y disparo de renders, **switch de idioma `en`/`es` y sección de guía**, todo por HTTP contra `apps/render-api` | `sdd/context/apps/web/constitution.md` |

> Al generar un subproyecto nuevo, sumar una fila a esta tabla (solo agregar filas — nunca reformatear la tabla completa).
> Las constituciones de subproyecto son la **fuente de verdad** del stack y las convenciones técnicas.
> La sección 3 de este documento es un resumen de alto nivel — siempre leer el subproyecto para detalles.

---

## 3. Stack Tecnológico (resumen — fuente de verdad en cada subproyecto)

> ⚠️ Este resumen es mantenido por el Reviewer al cerrar cada ciclo.
> Para el stack completo y actualizado de un subproyecto, leer su `constitution.md` individual.

### Monorepo

- **Nx** + **pnpm** como workspace manager [ajustar a las herramientas reales del proyecto]

### Snapshot de stacks por subproyecto

| Subproyecto | Stack base | Última actualización |
| ----------- | ---------- | -------------------- |
| `libs/timeline-core` | TypeScript estricto + Zod 4.5 + Vitest 4 + `@swc-node/register` (JSON Schema); **contrato `StoryboardDocument` del modo generativo (spec-008 cycle-01): documento, propuesta del modelo y JSON Schema derivado del mismo esquema, con `remotionScene` plano validado por refinamiento cruzado, ids/`index`/`createdAt` asignados por el servicio y sin `$schema`/`$id` porque esa clave desactiva en silencio la salida estructurada de un agente CLI**; **contrato `VoiceManifest` de la voz en off (spec-009 cycle-01): una `VoiceTrack` por escena con la duración REAL medida con ffprobe (reemplaza a `estimatedDurationMs`), origen `generated`/`uploaded`, `voiceId` presente si y sólo si es generada, y `hashNarration` (FNV-1a puro, no criptográfico) para detectar que el texto cambió desde que se sintetizó** | spec-009 cycle-01 \; **calidad de producción (spec-014 cycle-01): `MusicMixSettings.referenceLufs` (default -16) y la función pura `musicNormalizationGainDb` que los DOS renderers (grafo ffmpeg y `<Audio>` de Remotion) usan para derivar la misma ganancia desde `MediaAsset.audio.integratedLufs`; `MusicInput.mix` para que los niveles del preset lleguen a `audioMix.music` y a `planDucking` (antes `buildTimeline` hardcodeaba `DEFAULT_MUSIC_MIX`, así que tocar un preset era un no-op); capa opcional `timeline.logo` (`position` default `bottom-right`, `widthRatio` 0.32, `marginRatio` 0.035, `opacity` 1) con `LOGO_ASSET_NOT_FOUND`/`LOGO_ASSET_NOT_IMAGE`** \; **marcas de tiempo en el guion de voz (FIX-e-burgos-009-002): `parseVoiceScriptLines`/`stripVoiceScriptTimeMarks` y `planVoiceScriptPlacements` (pura) que coloca cada frase en su marca, acorta la pausa, acelera hasta `--length-scale` 0.85 y recién después desplaza; `VoiceScriptLine` gana `endMs`/`requestedStartMs`/`overflowMs`/`lengthScale` OPCIONALES (`schemaVersion` sigue en 1) y `VoiceInput.durationMs` recorta el clip de voz a su asset**; **`timeline.captionStyle` (FIX-e-burgos-003-003): los cinco estilos (`bold-impact`, `clean-sans`, `outline-pop`, `subtle-lower`, `off`) con `captionGroupingForStyle` y `minWords` en `groupWordsForCaptions` — con `minWords: 1` el corte es el MISMO OR de siempre, por eso el default renderiza byte a byte igual; `words` de las captions pasa de 1-3 a 1-10 y `emphasisIndex` de 0-2 a 0-9 en Timeline y EDL** | FIX-e-burgos-003-003 \| 2026-09-11 |
| `libs/auto-montage` | TypeScript estricto + Zod 4.5 + Vitest 4 (puertos de I/O inyectables, cero binarios en CI; montaje determinista por seed, smoke manual aparte); **quinto rol de asset `voice` (spec-009 cycle-01): `raw/voice/` para la locución propia, atado a `MediaKind` `audio`, en el catálogo y en el clasificador — la ingesta NO lo transcribe (`DEFAULT_TRANSCRIBE_ROLES` sigue en `['aroll']`), lo hace el job `voice` cuando se asocia la toma a una escena** | spec-009 cycle-01 \; **calidad de producción (spec-014 cycle-01): el ingest mide el loudness de los assets de rol `audio` y lo persiste en `asset.audio.integratedLufs` (un catálogo previo sin la medición NO se reusa, así que los proyectos viejos se actualizan solos); sexto rol `logo` en `raw/logo/` (png/jpg/webp); niveles de música por preset (`hardware` -4/-12 de publicidad, el resto -8/-18) que ahora sí viajan a la Timeline; `alignTranscriptToScript` alinea las captions al guion del productor por LCS sobre tokens normalizados conservando los tiempos de Whisper** \; **duración y estilo del montaje con voz generada (FIX-e-burgos-009-002 + FIX-e-burgos-003-003): con un `script-manifest.json` CRONOMETRADO el video dura el A-roll completo y `truncatedMs` se mide contra el fin de la NARRACIÓN (`narrationEndMs`), no contra el relleno de silencio; el guion se limpia con `stripVoiceScriptTimeMarks` antes de alinear las captions —si no, `[0:00]` llega literal a la primera caption—; `captionStyle` opcional con default por preset de montaje (`educational` → `subtle-lower`, el resto → `bold-impact`) escrito en la Timeline, y `preset.captions.maxWords` pasa de `1 | 2 | 3` a `number`** | FIX-e-burgos-003-003 \| 2026-09-11 |
| `libs/producer-tools` | TypeScript estricto + Zod 4 + `@modelcontextprotocol/sdk` 1.30 (stdio, solo subpaths) + Vitest 4; contrato de 14 tools congelado, handlers sobre el puerto `RenderApiClient`, servidor MCP acotado a un proyecto, `buildProducerPrompt`; `extract_frames` sin `outputSchema` para que Claude Code pase las imágenes | spec-017 cycle-01 \| 2026-09-23 |
| `libs/local-store` | TypeScript estricto + better-sqlite3 13 (cargado con `createRequire`) + drizzle-orm 0.45 + Vitest 4 sobre base real `:memory:`; migraciones a mano por `user_version` con test de drift contra el schema Drizzle | spec-017 cycle-02 \| 2026-09-23 |
| `tools/render-cli` | TypeScript estricto (ESM, Node >= 22) + `node:util parseArgs` + Vitest 4 (puertos inyectables, cero binarios en CI; render real solo en el target `smoke`) — cero dependencias npm propias; superficie de errores íntegramente en inglés (`[usage]`, `[internal]`, `resource:`, `expected:`, `cause:`, `hint:`) y etapa real del comando en el header cuando el comando se reconoció (FIX-e-burgos-002-002) | FIX-e-burgos-002-002 \; **`--script <ruta>` y `--no-logo` en `plan`/`run` (spec-014 cycle-01), con `logo:` y `script-corrections:` en el reporte de `plan`; `ingest`/`render` rechazan las cuatro opciones** \; **`render` entrega la mezcla masterizada, no el audio de Remotion (spec-015 cycle-01): render mudo → `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`, intermedios en `work/renders/<slug>/` y entregable `out/<slug>.mp4` sin cambio de nombre; tres puertos nuevos en `CliDependencies`; el desfase contra la locución pasa de +40 ms a 0 ms y el audio decodificado da el MISMO sha256 que el del job de la API; `media-local` entra por import ESTÁTICO y tiene que seguir así (un `await import()` la marca lazy-loaded y rompe el lint de los ocho archivos que la importan)** \; **`--caption-style <bold-impact|clean-sans|outline-pop|subtle-lower|off>` en `plan`/`run` (FIX-e-burgos-003-003), reexportando el union de `timeline-core` en vez de copiarlo; `ingest`/`render` ahora rechazan OCHO opciones de plan** | FIX-e-burgos-003-003 \| 2026-09-11 |
| `libs/media-local` | TypeScript estricto + execa 10 + Zod 4.5 + Vitest 4 (fixtures de ffprobe grabadas, fixtures de ffmpeg/whisper reconstruidas a mano, cero binarios en CI) + capa pura de mezcla de audio en `src/mix/`: `AudioMixPlan`/`Timeline` → `FilterGraph` tipado → `-filter_complex` y args de ffmpeg, sin ejecutar el binario (paridad de la curva de ducking con el preview de Remotion fijada por tabla) + capa de ejecución en `src/ffmpeg/`: `mixTimelineAudio` (N+1 pasadas, master bus `alimiter level=disabled`), `verifyMixLoudness` (tolerancias declaradas) y `muxAudioIntoVideo` (`-c:v copy`, AAC 192k); target manual `smoke-audio` con ffmpeg real, fuera de CI; **Piper TTS como quinto y sexto binario (spec-009 cycle-01): `piperCli`/`PIPER_PATH` con fallback por `PATH` y `piperModel`/`PIPER_MODEL_PATH` sin él (contrato de `whisperModel`, generalizado a una lista `MODEL_BINARY_NAMES`), `resolveVoiceBinaries` aparte de `resolveBinaries` para no degradar el montaje, wrapper `synthesizeSpeech` (la narración entra por ARCHIVO, no por stdin, y colapsada a una línea porque Piper trata cada línea como una emisión) y `buildVoiceCatalog` puro; salida de Piper 22 050 Hz mono, quien la consuma remuestrea** | spec-009 cycle-01 \; **normalización de la cama musical (spec-014 cycle-01): `buildMusicBedChain` antepone `volume=<g>dB` derivado de `asset.audio.integratedLufs` y `audioMix.music.referenceLufs` ANTES de las ganancias del preset, y `apad` pasa a `apad=whole_dur=<dur>`; la medición viene del catálogo, no de una pasada extra de ffmpeg en el mix** \; **catálogo de voces enriquecido (spec-016 cycle-01): `buildVoiceCatalog` pasa a recibir `{ fileName, config }` por modelo y a derivar `language {code, region}` (BCP47), `quality` (`x_low|low|medium|high` o `null`), `label` legible y `description` factual del `.onnx.json` de Piper, con fallback al nombre del archivo y `describeVoiceModel` expuesto aparte; NO se publica género, edad ni carácter de la voz porque el sidecar no los documenta** \; **colocación absoluta de voz y control de velocidad (FIX-e-burgos-009-002): `placeSpeechSegments` (un `adelay` por segmento + `amix=inputs=N:normalize=0` —sin `normalize=0` el nivel se divide por la cantidad de entradas aunque no se pisen— con `apad=whole_dur` opcional) al lado de `concatSpeechSegments`, que sigue siendo el camino del guion sin marcas; `synthesizeSpeech` acepta `lengthScale` y con `undefined`/`1` emite exactamente los mismos args** \; **`extractFrame`, `buildKenBurnsClip` (en frames, nunca `-t`) y `concatVideoClips` (spec-017 cycle-01)** | spec-017 cycle-01 \| 2026-09-23 |
| `libs/composition-remotion` | React 19 + Remotion 4.0.522 (`transitions`/`bundler`/`renderer`/`cli`) + Vitest 4/jsdom (cero render en CI) + kinetic captions completos: presets con animación `spring`, safe zones por plataforma, plan de caja por clip y `<KineticCaptions />` cableado en `TimelineComposition` (helpers puros, sin binarios de fuente); target `smoke` funcional desde FIX-e-burgos-001-001; `renderTimeline`/`TimelineComposition` aceptan `audio: 'mix' \| 'muted'` (default estructural, render mudo para el mux de `media-local`); componente de video conmutable `TimelineVideo` + contexto `VideoBackendProvider` (default `'render'` → `OffthreadVideo`; `'player'` → `Video`), usado por `ArollSeries` y `BrollTrack`; **paridad de encuadre preview/render resuelta (D-12): `objectFit: 'fill'` sólo en la rama `player`, con el estilo del llamador ganando por orden de spread y la rama `render` invariante carácter por carácter — `sha256` del render reproducido y ningún contrato público cambiado; el encuadre defectuoso es el del render (estirado anamórfico 16:9 en 9:16) y está descopado a un `[FIX]`**; `coverage.include` cubre `src/render.ts`, los dos archivos del conmutador y `src/components/audio-track.tsx` (93,85 % stmts con el piso global de 80 % intacto), el resto de `src/components/**` descopado con fundamento medido (FIX-e-burgos-001-002); bundle webpack verificado de punta a punta por el smoke E2E de `spec-005 cycle-03` | spec-006 cycle-03 \; **capa de logo y cama normalizada (spec-014 cycle-01): `LogoOverlay` montado entre el B-roll y las captions (nunca tapa texto) con geometría pura en `logoOverlayBox`/`logoOverlayStyle`, y `volumeAtFrame(automation, frame, offsetDb)` sumando la misma ganancia de normalización que el grafo de ffmpeg** \; **el estilo de captions sale del documento (FIX-e-burgos-003-003): `captionPresetIdForStyle` resuelve `timeline.captionStyle ?? captionPreset` (el documento gana sobre la prop de preview) y con `'off'` no se monta `<KineticCaptions>`; `render.ts` no cambió — `inputProps` sigue siendo `{ timeline, audio? }` y el estilo viaja adentro del timeline** | FIX-e-burgos-003-003 \| 2026-09-11 |
| `apps/render-api` | TypeScript estricto (ESM, Node >= 22) + `node:http` + Vitest 4 — cero dependencias npm propias; store de medios sobre `media/` por HTTP y **cola de jobs de render en proceso** (15 endpoints: proyectos, assets con upload binario atómico y catálogo consistente en la misma request, `Timeline`/`EDL` con los mismos bytes que la CLI, descarga de artefactos con `Range`, y jobs con progreso por frame y cancelación cooperativa vía estado transitorio `canceling`) detrás del puerto `ObjectStorage` (único adaptador `fs`, MinIO descopado por D-11) más `probeAsset` y `randomId`; router con parámetros y comodín, superficie de errores propia de 37 códigos, estado vivo por servidor en `RenderApiRuntime` (cola + serializador de uploads, sin estado de módulo) y `runRenderPipeline` disparado por `POST /projects/:slug/jobs`; concurrencia 1 e in-memory, sin persistencia entre reinicios; verificado con smoke real E2E (Remotion + FFmpeg, 538 frames a 1080×1920); las libs pesadas entran sólo por `await import()` en el único adaptador de producción; sin `eslint.config.mjs` propio (D-9); **segundo tipo de job en la misma cola (`kind: 'montage'`, spec-007 cycle-01): `ingestProject` + `autoMontage` sobre `media/<slug>/` con `preset`/`seed`/`overwrite` (`409 TIMELINE_ALREADY_EXISTS` sin `overwrite`), etapas propias `discover`/`probe`/`transcribe`/`plan` con progreso monótono y cancelación cooperativa sólo entre llamadas opacas, `Job`/`JobSummary` como unión discriminada por `kind` retro-compatible campo por campo con lo que `apps/web` ya consume (que no se tocó), `POST /projects/:slug/jobs` leyendo body por primera vez (body ausente/vacío/sin `kind` = el render de antes byte por byte), `GET /health` con los cuatro binarios de media y `capabilities.montageQueue`; `edl.json` byte-idéntico al de la CLI verificado por sha256 y probado sensible al `seed`**; **tercer tipo de job (`kind: 'storyboard'`, spec-008 cycle-01): puerto `aiAgent` con adaptador `ClaudeCliAiAgent` que invoca `claude -p` por el `CommandRunner` inyectable —sin API key, con las tools deshabilitadas y `cwd` neutro fuera del repo—, `brief` XOR `scriptText` con `overwrite` (`409 STORYBOARD_ALREADY_EXISTS`), etapas `collect`/`propose`/`persist`, nueve códigos de error nuevos con `502` para el fallo del agente externo, `EP-016`..`EP-018` (documento, `PUT` y export de prompts en `text/plain` numerado) y `capabilities.storyboardQueue`; smoke real ejecutado contra `claude -p`**; **cuarto tipo de job (`kind: 'voice'`, spec-009 cycle-01): Piper TTS local por el mismo `CommandRunner`, una pista por escena desde `work/storyboard.json` normalizada a 48 kHz mono y transcrita con whisper-cli para alinear captions, con `voice`/`sceneIds`/`overwrite` (`409 VOICE_ALREADY_EXISTS`), etapas `synthesize`/`transcribe`/`persist` con contador por escena, once códigos de error nuevos, `EP-019` `GET /voices` · `EP-020` `GET /projects/:slug/voice` · `EP-021` `PUT .../voice/scenes/:sceneId` (la locución subida gana sobre la sintetizada, incluso con `overwrite`), rol `voice` en el store y los dos binarios de Piper en `/health` con `capabilities.voiceQueue`; la duración real reemplaza a la estimada del modelo (hasta 1 958 ms de diferencia en el smoke); TODO path que cruza a un puerto de media va ABSOLUTO —el `cwd` alcanza para el binario pero no para el wrapper, que lee su JSON con `readTextFile`** | spec-009 cycle-01 \; **el job `montage` acepta `scriptPath` XOR `scriptText` y `logo: 'auto'|'off'` (spec-014 cycle-01), con `MONTAGE_SCRIPT_INVALID`/`MONTAGE_LOGO_INVALID` (422) y `MONTAGE_SCRIPT_NOT_FOUND` (404 al asentar el job), y `logoAssetId`/`scriptAlignment` en el reporte; el listado de assets acepta el rol `logo` sin ensanchar `assetCounts`** \; **productor conversacional detrás de la API (spec-015 cycle-01): la skill `video-producer` corriendo como proceso `claude -p` headless con herramientas, sesión retomable (`--session-id` y después `--resume`) y kill, FUERA de la cola de jobs (el agente encola `montage`/`render` en esta misma API y los espera: con concurrencia 1 se bloquearía solo), un turno activo por PROYECTO, `EP-022`..`EP-025` (conversación, mensaje con 202, estado del turno con eventos `text`/`tool`/`status` y sugerencias, cancelación que MATA el hijo) y `capabilities.producer` en `/health` sin volver `degraded` a nadie; conversación persistida en `work/producer/` (`conversation.json`, `conversation.md`, `session.json`, `turns/<turnId>.jsonl`); ocho códigos de error nuevos; tres puertos nuevos (`producerAgent`, `readSkillDocument`, `probeProducerBinary`) y un `SpawnProducerProcess` inyectable porque el `CommandRunner` bufferea; `close()` del servidor cancela los turnos vivos (un hijo huérfano sigue escribiendo en el proyecto); smoke real con `claude -p` de punta a punta: dos turnos, montage + render encolados por la API y MP4 de 778 frames entregado** \; **usabilidad del catálogo de voces (spec-016 cycle-01): `EP-019` publica por voz `language`/`quality`/`label`/`description`/`previewUrl` (el puerto `listVoiceModels` lee además el `.onnx.json` de cada modelo y tolera uno corrupto), y `EP-026` `GET /voices/:voiceId/preview` sintetiza con Piper una frase fija (~4 s), la cachea FUERA de `media/` (`PIPER_PREVIEW_CACHE_DIR`, default en el tmp del SO, nombre de archivo versionado por revisión de la frase, invalidado por `mtime` del `.onnx`) y la sirve como `audio/wav` con `Cache-Control`; corre FUERA de la cola (concurrencia 1: un preview detrás de un render no es un preview) con exclusión por voz en `runtime.voicePreviewSerializer`; `404 VOICE_NOT_FOUND` / `503 VOICE_MODEL_UNAVAILABLE`; medido: miss 1,3-1,7 s contra hit 3-6 ms** \; **borrado de assets (FIX-e-burgos-005-001): `EP-027` `DELETE /projects/:slug/assets/:role/:filename` con el confinamiento y el mutex por slug del upload, limpieza del catálogo y de la transcripción derivada, `404 ASSET_NOT_FOUND` y `409 ASSET_IN_USE` (los usos en `hint`) con `?force=true` para borrar igual devolviendo `timelineReferences`; puerto `ObjectStorage.removeFile` y **`toRequestLine` pasa a conservar el query string**, que hasta ahora tiraba —ningún handler podía leer un parámetro; 39 códigos de error, 27 endpoints** \; **narración cronometrada y estilo de captions (FIX-e-burgos-009-002 + FIX-e-burgos-003-003): el job `voice` lee marcas `[m:ss]`/`[m:ss-m:ss]` y arma la pista en dos pasadas del planificador (la segunda sin acelerar es la que fija `startMs`/`overflowMs`), con el puerto nuevo `placeVoiceTracks` y `lengthScale` en `synthesizeVoice`; el job `montage` acepta `captionStyle` con `MONTAGE_CAPTION_STYLE_INVALID` (422) y su reporte gana `captionStyle`; el system prompt del productor exige sincronizar la narración con la acción (mirar el video con `ffmpeg -ss` si el usuario no dio tabla de escenas) y elegir el estilo por tipo de video; 40 códigos de error** \; **productor sin shell (spec-017 cycle-01): `claude -p` con `--tools ""`, `--strict-mcp-config`, MCP `studio` inline acotado al proyecto y `--allowedTools mcp__studio`, `cwd` estable y vacío por proyecto; EP-029..EP-035 (probe, frames, texto permitido, copia de assets, música de Commons con host fijo) y quinto job `photo-aroll`; `PRODUCER_SKILL_PATH` eliminado — el prompt sale de `libs/producer-tools`** \; **estado en SQLite (spec-017 cycle-02): proyectos, organización, conversación y sesión del productor y jobs en `libs/local-store` (`RENDER_API_DB_PATH`), payloads sin cambios; jobs persistidos, `JOB_INTERRUPTED` al arrancar y `EP-036` retry; importación de `media/` al arrancar, de solo lectura e idempotente; `/health.store`** | spec-017 cycle-02 \| 2026-09-23 |
| `apps/web` | React 19 + `react-router-dom` 7 + Tailwind CSS 4 + Vite 8 + Vitest 4/jsdom con `@testing-library/react` + **`@remotion/player` 4.0.522** (única dependencia npm propia, versión exacta de `remotion`); Web Studio **completo**: shell con badge de salud, alta y listado de proyectos, biblioteca de assets crudos por rol reproducidos desde `EP-011` con upload binario, preview de la `Timeline` persistida (`EP-007`) montada en el `<Player>` de Remotion con la composición real de `composition-remotion` (backend de video `player`, assets reescritos a URLs same-origin de `EP-011`, encuadre en paridad con el render por D-12), **edición del documento persistido sobre un draft local (trim/orden de escenas, texto de captions, niveles de música con reescritura de `audioMix.automation`, preset de salida) reflejada en el Player antes de guardar y persistida con un único `PUT` completo de `EP-008`, validación de cliente espejo de `validateTimeline` clasificada por severidad, y jobs de render (`EP-012`..`EP-015`) con polling propio, cancelación y descarga del MP4 por `EP-011`** — ruta de preview code-split (chunk inicial 249 kB; `timeline-edit/**` y Zod sólo en el chunk perezoso); toda la frontera con el servicio confinada a `src/api/` (tipos del contrato declarados desde `sdd/api.json`, cliente tipado, `RenderApiError` con los 37 códigos del servicio más 3 propios de transporte) y transporte exclusivamente por el proxy `/api` del dev-server (`render-api` no emite CORS); estado de servidor con `useAsyncResource` propio y sin librería de queries (D-3 mantenida con el polling de jobs como consumidor real, cero deps nuevas); sin `eslint.config.mjs` propio (D-9); verificado con smoke E2E real de punta a punta con Playwright (edición → `PUT` verificado en disco → render → progreso por frame → MP4 + `ffprobe`); **generación del montaje desde la biblioteca (spec-007 cycle-02): `Job` como unión discriminada por `kind` espejo del servicio, `createMontageJob` sobre `EP-012` con preset/seed/overwrite, `MontageTrigger` + `MontageJobPanel` con progreso por etapa y salto automático al preview, confirmación explícita ante `409 TIMELINE_ALREADY_EXISTS`, estado vacío accionable del preview ante `TIMELINE_NOT_FOUND`, y panel de salud con los cuatro binarios y `capabilities.montageQueue` que deshabilita el montaje con el motivo escrito; segundo E2E `montage-smoke.mjs` que va de `raw/` al MP4 por la web (montaje 4,7 s, render 11,7 s, `nb_frames` del stream de video == `durationFrames`)**; **modo generativo (spec-008 cycle-02): ruta `/projects/:slug/storyboard` también code-split, tercera rama `StoryboardJob` de la unión, `StoryboardTrigger` (brief XOR guion pegado o subido, gating por `capabilities.storyboardQueue`, confirmación ante `409 STORYBOARD_ALREADY_EXISTS`, aviso de que `propose` tarda más de un minuto y traducción a lenguaje de usuario de los cuatro códigos del agente), storyboard editable escena por escena con `StoryboardDocumentSchema` de `timeline-core` como espejo de cliente del 422 y un único `PUT` de `EP-017`, hoja numerada de prompts copiada de `EP-018` **sin recomponerla**, nav por proyecto en el layout y `aria-label` explícito en todo control (React mete el valor del textarea y las options en el `<label>`); tercer E2E `storyboard-smoke.mjs` con `claude -p` real (propose 65,5 s, 5 escenas, `PUT` verificado en disco, portapapeles comparado byte a byte, 409 confirmado)**; **voz en off del modo generativo (spec-009 cycle-02): ruta perezosa `/projects/:slug/voice` con el nav en `library · storyboard · voice · preview`, cuarta rama `VoiceJob` de la unión (progreso por escena `processedScenes`/`totalScenes`), `VoiceTrigger` con el selector de voces de `EP-019` (default marcado, `503 VOICE_MODEL_UNAVAILABLE` distinguido del catálogo vacío) y confirmación ante `409 VOICE_ALREADY_EXISTS`, `VoiceSceneCard` con reproductor por `EP-011`, duración real de `ffprobe` contra la estimada del storyboard, marca de `stale` de `EP-020` y regeneración de una sola escena con la voz que esa pista ya usaba, y 'use my recording' encadenando `EP-006` (rol `voice`) con `EP-021` en un gesto; `voiceBlockers` mira los SEIS binarios del pipeline (no los cuatro del montaje) y el manifest se valida con guards estructurales, sin Zod; cuarto E2E `voice-smoke.mjs` con Piper y whisper reales, sembrado con un storyboard de una corrida anterior en vez de llamar a `claude -p` (5 pistas en 22,2 s, los cinco `<audio>` medidos en `readyState` 4 en el navegador, regeneración de una escena probada por sha256 sobre las otras cuatro, toma propia asociada y verificada en el manifest en disco); las cinco escenas duraron MENOS de lo estimado (0,35 s a 2,02 s), así que armar la Timeline con `estimatedDurationMs` desincroniza el video** | spec-009 cycle-02 \; **spec-014 cycle-01 sólo agrega la severidad `render-blocking` de `LOGO_ASSET_NOT_FOUND`/`LOGO_ASSET_NOT_IMAGE` al espejo de `validateTimeline` (ensanchar un tipo suma es un cambio global): la UI del logo y del guion llega con la pantalla del chat**; **pantalla del productor (spec-015 cycle-02, cierra la spec): `/projects/:slug/producer` perezosa y PRIMERA parada del proyecto (nav `producer · library · storyboard · voice · preview`, y cada tarjeta del listado abre ahí), chat sobre `EP-022`..`EP-025` con markdown propio a mano (encabezados, listas, reglas, TABLAS, bloques cercados y código inline — la lista salió de lo que el agente realmente contesta), envío con Enter, actividad del turno en vivo cada 2,5 s con eventos legibles, reloj y Cancel que mata el proceso, `suggestions` y opciones numeradas como chips que envían ese texto tal cual, estado vacío con el inventario real (`EP-005`) y sugerencias editables, jobs del agente visibles mientras corre y refresco de conversación/assets/jobs al cerrar el turno; los 8 códigos del productor con su code MÁS una frase de usuario (429 dice que la conversación queda guardada); **el turno NO entró a la unión `Job`** (no tiene `kind`, `state` ni `progress`: forzarlo traía de vuelta el antipatrón de opcionales) y tiene su propio `useProducerTurnPoll`; capa de logo desde la UI en la página de preview (`timeline-edit/logo-overlay.ts` escribe `timeline.logo` **y** el `MediaAsset` en `assets`, habilitado sólo con un logo probado en el catálogo) y presets de montaje con etiqueta y descripción legibles sin tocar sus ids; chunk inicial 478 kB, `producer-page` 23,1 kB, sin aviso de 500 kB; E2E `producer-smoke.mjs` con `claude -p` real sobre copia temporal de `media/demo-01`: turno 1 147,3 s/29 eventos, turno 2 442,0 s/54 eventos con `montage` + `render` encolados por el agente y MP4 de 778 frames a 1080x1920, logo verificado en disco y cancelación con cero `claude` vivos** \; **usabilidad del studio (spec-016 cycle-01): `VoicePicker` (COMP-045) reemplaza el `<select>` de ids Piper por tarjetas con etiqueta legible, idioma, calidad, descripción y botón de reproducción sobre `EP-026` (`<audio preload="none">` por tarjeta, una sola sonando a la vez, `idle|loading|playing|error` y el fallo explicado en pantalla); el selector de rol del `AssetUploader` pasa a tarjetas con nombre legible, directorio `raw/<rol>/`, impacto en el video final, marca de obligatorio en A-roll y la regla de matching de B-roll escrita, con TODO el copy en `src/api/asset-roles.ts` (un módulo para que `cycle-02` traduzca uno y no seis componentes); se aplican los textos de arranque del productor de FIX-e-burgos-007-002; chunk inicial 479 kB sin aviso de 500 kB; E2E `voices-smoke.mjs` con Piper real: 3 voces listadas, dos reproducidas en Chrome con `readyState` 4 y 2,93 s/3,37 s** \; **i18n y guía (spec-016 cycle-02, cierra la spec): mecanismo de traducción PROPIO en `src/i18n/`, cero deps — el catálogo `en` es la fuente de verdad tipada (`as const satisfies` → `TranslationKey`) y el `es` se declara `Record<TranslationKey, string>`, así que la paridad la garantiza `tsc` en las dos direcciones y un spec la vuelve a aserar en runtime; `t(key, params)` con interpolación `{param}` y `tn(key, count)` con `.one`/`.other`; `useT()` SIN provider devuelve el catálogo inglés, que es lo que dejó verdes las 78 suites existentes sin tocarlas; idioma inicial `localStorage` → `navigator.languages` → `en`, persistido y estampado en `documentElement.lang`; el catálogo `es` se carga PEREZOSO (26,4 kB propios) porque el chunk inicial no lo aguantaba, y `/projects/:slug` pasó a ruta perezosa para recuperar 22 kB; `LanguageSwitch` (COMP-046) en el header y `/guide` (COMP-047) perezosa con el contenido de los dos idiomas en chunks propios, dibujada con el markdown del productor (tablas incluidas); TODO el copy visible migrado a claves —incluidos roles de subida, presets de montaje y de salida, editores, chips del productor y las explicaciones de los códigos de error, que pasaron de `string[]` a `{key, params}`—, con los ids técnicos (`youtube-16x9`, `aroll`, `es-AR`, los `code`) siempre visibles al lado; el `label`/`description` de `GET /voices` y el `message` del servicio NO se traducen: son dato del servicio; el "no hay copy literal" lo verifica un scanner propio (`literal-copy-scan.ts`, probado sensible) corrido sobre los 44 `.tsx` de `pages`, `components` y `app` por `import.meta.glob` —no un plugin de ESLint, que está vedado por D-9 y por el hook `config-protection`; chunk inicial 490,17 kB sin aviso de 500 kB; E2E `i18n-smoke.mjs` con Chrome y Piper reales: nav, roles, welcome del productor, tarjetas de voz y guía en español, persistido tras recargar, y la guía completa en los dos idiomas** \; **borrado de assets desde la biblioteca (FIX-e-burgos-005-001): `AssetDeleteControl` en cada tarjeta con confirmación por nombre de archivo y, ante `409 ASSET_IN_USE`, los usos de la timeline más **Delete anyway** (`?force=true`); `deleteAsset` en el cliente y `error.ASSET_IN_USE`/`error.ASSET_NOT_FOUND` en los dos catálogos i18n; E2E `delete-asset-smoke.mjs` (subida por la UI, borrado verificado en disco y en `catalog.json`, aviso de en-uso sobre el A-roll de la timeline y borrado forzado)** \; **badge "Interrumpido" y botón "Volver a intentar" en los cuatro paneles de jobs sobre `EP-036` (spec-017 cycle-02), verificado en Chrome en/es** | spec-017 cycle-02 \| 2026-09-23 |

---

## 4. Metodología SDD (Spec-Driven Development)

El proyecto se rige estrictamente por SDD. Ninguna funcionalidad se codifica sin antes completar el ciclo de diseño.

### 4.1 Ciclo de Agentes y Roles

1. **Orquestador:** Lee la especificación (`sdd/specs/`) y el estado (`sdd/global.json`), valida dependencias y prepara el `cycle_brief` con contexto mínimo para cada agente especializado.
2. **Funcional:** Toma el `cycle_brief` y genera historias de usuario (HU) y requisitos funcionales (RF) en lenguaje de negocio.
3. **Planner:** Descompone las historias en tareas técnicas ordenadas y estimadas (story points).
4. **Arquitecto:** (En paralelo con el Planner) Diseña la estructura técnica, define el esquema de datos y los contratos de la API.
5. **Implementador Backend:** Desarrolla la API y lógica de backend siguiendo los contratos y la tarea asignada.
6. **Implementador Frontend:** Desarrolla la UI y vistas del frontend.
7. **Reviewer:** Valida la calidad, tests, cumplimiento de requisitos y aprueba para cerrar el ciclo.

### 4.2 Reglas Estrictas del Proyecto

> ⛔ **SPEC GATE — REGLA GLOBAL INVIOLABLE**
> Antes de escribir UNA SOLA LÍNEA de código de implementación, el agente DEBE verificar:
>
> 1. Existe un archivo `.spec.md` en `sdd/specs/` para el módulo que se va a desarrollar
> 2. El módulo figura en `pending_modules` o `in_progress_modules` de `sdd/global.json`
> 3. Existe un `cycle_brief` generado por el Orquestador
> 4. Existen historias de usuario generadas por el Funcional
> 5. Existen tasks técnicas en `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` generadas por el Planner
> 6. Existen contratos de API y schema definidos por el Arquitecto
>
> Si alguna de estas condiciones NO se cumple → **DETENER** y completar los pasos faltantes antes de continuar.

1. **SPEC GATE:** Ninguna implementación puede iniciarse sin haber completado el flujo de diseño SDD completo para ese módulo.
2. **Memoria como Fuente de Estado:** El estado del proyecto reside en `sdd/global.json`, `sdd/schema.json`, `sdd/api.json`, `sdd/components.json` y los `tasks.json` per-cycle (índice generado en `sdd/tasks.json`). Todos validan contra `sdd/schemas/` (`pnpm sdd:validate`).
3. **Lectura Obligatoria:** Es obligatorio leer `sdd/global.json` antes de iniciar cualquier tarea.
4. **Prohibido el Cambio Manual:** Nunca edites manualmente los archivos de estado de `sdd/` (solo los agentes en su flujo SDD los actualizan al inicio o fin del ciclo).
5. **Comentarios:** sin comentarios explicativos del QUÉ ni referencias a task/spec/ciclo — ver
   "Estilo de código (INVIOLABLE)" en `sdd/agents/sdd-implementor-back.agent.md` /
   `sdd-implementor-front.agent.md`. Único comentario permitido: una línea en inglés para un POR QUÉ
   no obvio.
6. **Ejecución Nx:** Siempre prefiere utilizar `pnpm nx` (o el package manager configurado) para ejecutar tareas del monorepo.
7. **Orden de ciclos:** Los ciclos se ejecutan en el orden definido en `planned_cycles` de `sdd/global.json`. Un ciclo no puede comenzar si el ciclo anterior no está `completed`.
8. **Un ciclo a la vez:** Nunca iniciar un segundo ciclo si hay uno en `in_progress_modules`.
9. **Contextos siempre frescos, vía fragmentos aditivos:** durante un ciclo/fix NUNCA se editan directamente `constitution.md` ni `context_prompt.md` del subproyecto — el cierre escribe un fragmento append-only en `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md` (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`). El contexto vigente = archivos base + `updates/*.md` en orden de nombre. La consolidación (fusionar fragmentos en los archivos base, eliminar lo obsoleto y borrar los fragmentos) es operación de un solo actor: el Orquestador al iniciar un ciclo nuevo sobre ese subproyecto, o el Reviewer si se acumulan ≥5 fragmentos.
10. **Specs numeradas y registradas:** Toda spec DEBE tener un ID con formato `spec-[gh-user]-[NNN]-[slug]`, la carpeta y el archivo `.spec.md` DEBEN seguir esa convención, y DEBE estar registrada en `sdd/specs/index.json` antes de ser referenciada en cualquier otra parte del arnés.

### 4.2.1 Convención de naming de specs

```
Formato de carpeta:   sdd/specs/spec-[gh-user]-[NNN]-[slug]/
Formato de archivo:   spec-[gh-user]-[NNN]-[slug].spec.md
Ejemplo:              sdd/specs/spec-jdoe-001-user-onboarding/spec-jdoe-001-user-onboarding.spec.md

Encabezado obligatorio en el archivo:
  > spec-id: spec-[gh-user]-[NNN]-[slug]
  > slug: [slug]
  > módulo: [nombre del módulo en global.json]
  > estado: activo | completado | deprecado
  > fecha: YYYY-MM-DD

Registro centralizado: sdd/specs/index.json
  - specs[]: array con entrada por cada spec creada (append-only, sin last_id global)
  - Al crear una nueva spec: agregar entrada al array
```

> ⛔ No crear specs sin registrarlas primero en `sdd/specs/index.json`.
> La referencia canónica al archivo de spec en `global.json`, `tasks.json` y cualquier otro lugar
> DEBE usar la ruta completa: `sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md`.

### 4.3 Flujo Obligatorio Antes de Implementar

```
┌─────────────────────────────────────────────────┐
│              SPEC GATE (VERIFICACIÓN)           │
│  1. ¿Existe spec en sdd/specs/?  → SI / NO      │
│  2. ¿Está en global.json?        → SI / NO      │
│  3. ¿Hay {spec-id}/cycles/cycle-[XX]/brief.yaml?   → SI / NO  │
│  4. ¿Hay {spec-id}/cycles/cycle-[XX]/functional.md? → SI / NO  │
│  5. ¿Hay {spec-id}/cycles/cycle-[XX]/planner.md?   → SI / NO   │
│  6. ¿Hay {spec-id}/cycles/cycle-[XX]/architect.md? → SI / NO   │
│  7. ¿Existe contexto del subproyecto? → SI / NO  │
│                                                 │
│  TODO SI → Continuar a implementación           │
│  ALGÚN NO → Completar el paso faltante          │
└─────────────────────────────────────────────────┘
            ↓ (solo si TODO ES SI)
┌─────────────────────────────────────────────────┐
│         IMPLEMENTACIÓN (task por task)          │
│  sdd-implementor-back  →  una TASK-BE a la vez  │
│  sdd-implementor-front →  una TASK-FE a la vez  │
└─────────────────────────────────────────────────┘
            ↓ (al finalizar todas las tasks)
┌─────────────────────────────────────────────────┐
│  REVIEWER → cierra el ciclo                    │
│  Crea {spec-id}/cycles/cycle-[XX]/cycle.json    │
│  Actualiza global.json, schema.json, api.json   │
└─────────────────────────────────────────────────┘
```

### 4.4 Documentos obligatorios por ciclo

Cada ciclo de desarrollo DEBE tener los siguientes archivos en `sdd/specs/{spec-id}/cycles/cycle-[XX]/`:

| Archivo         | Generado por                                      | Momento                         |
| --------------- | ------------------------------------------------- | ------------------------------- |
| `brief.yaml`    | sdd-orchestrator                                  | Al iniciar el ciclo             |
| `functional.md` | sdd-functional                                    | Antes de planner/arquitecto     |
| `planner.md`    | sdd-planner                                       | En paralelo con arquitecto      |
| `architect.md`  | sdd-architect                                     | En paralelo con planner         |
| `tasks.json`    | sdd-planner                                       | En paralelo con arquitecto      |
| `cycle.json`    | sdd-orchestrator (inicio) / sdd-reviewer (cierre) | Al iniciar y al cerrar el ciclo |

### 4.5 Contexto de subproyectos

Cada app, lib y tool del monorepo tiene su propio contexto en `sdd/context/`.
Este contexto refleja la constitución y el context_prompt específicos para ese subproyecto,
y los agentes DEBEN leerlo antes de generar documentos o código para ese subproyecto.

```
sdd/context/
├── constitution.md          ← Contexto GLOBAL del monorepo (NO modificar directamente)
├── context_prompt.md        ← Entry point GLOBAL (NO modificar directamente)
├── apps/                    ← Un directorio por app generada en Nx
│   └── [nombre]/
│       ├── constitution.md
│       ├── context_prompt.md
│       └── updates/            (fragmentos aditivos pendientes de consolidar)
├── libs/                    ← Ídem por lib
└── tools/                   ← Ídem por tool
```

**Regla:** Todo agente que trabaje sobre un subproyecto DEBE leer primero:

1. `sdd/context/context_prompt.md` — para entender el monorepo global
2. `sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md` + `constitution.md` + `updates/*.md` (en orden de nombre) — para entender el subproyecto con su contexto vigente

**Regla de frescura — mecanismo aditivo (ver sección 🧩 de `sdd/dual-harness/CLAUDE.md`):**

- Al cerrar un ciclo/fix, el delta se escribe como fragmento en
  `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
  (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`) — nunca editando los archivos base
- Los archivos base y su encabezado `> Última actualización: cycle-[N] | Fase: [fase] | Fecha: [YYYY-MM-DD]`
  solo los toca la consolidación (operación de un solo actor: Orquestador al iniciar un
  ciclo nuevo sobre ese subproyecto, o Reviewer si se acumulan ≥5 fragmentos)
- La consolidación funde los fragmentos, elimina toda información obsoleta y borra los
  fragmentos consolidados
- El contexto incorrecto es peor que no tener contexto: menos y correcto > más e incorrecto
