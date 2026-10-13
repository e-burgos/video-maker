# Constitución — apps/render-api

> Versión 4.0 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario, sin auth propia — opcionalmente
  detrás de un token de acceso cuando la empaqueta Electron; sin despliegue cloud)
- **Rol en el sistema:** expone por HTTP el motor de edición y el store de medios sobre `media/`:
  proyectos, assets crudos, `Timeline`/`EDL` persistidos, storyboard, voz, foto-a-roll, descarga de
  artefactos, una cola de jobs con progreso y cancelación, y el **productor conversacional** (MCP,
  con motor Claude CLI u OpenRouter). Es el único subproyecto que puede depender de
  `libs/media-local` y `libs/composition-remotion` a la vez (ver `context_prompt.md`).
- **Estado:** **completo y verificado contra binarios reales.** rutas `EP-001`..`EP-073` (registradas en
  `sdd/api.json`), cobertura sostenida ≥ 80 % (umbral del proyecto).
  Corre tanto en dev (TypeScript vía `@swc-node/register`) como empaquetado (`render-api:bundle`,
  CJS) para Electron.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- **Cero dependencias npm propias** (D-2 de `spec-005`, sostenido en todos los ciclos): servidor
  sobre `node:http`, filesystem con `node:fs/promises`, paths con `node:path/posix`, ids con
  `node:crypto`, proceso hijo del productor con `node:child_process`. `apps/render-api` **no tiene
  `package.json` propio**. Las libs de las que depende sí traen las suyas (`better-sqlite3`/
  `drizzle-orm` vía `@video-maker/local-store`, `@modelcontextprotocol/sdk` vía
  `@video-maker/producer-tools`, este último no importado directo).
- Workspace: `@video-maker/timeline-core` (tipos/schemas), `@video-maker/auto-montage` (proyecto de
  medios, catálogo, escritores de `Timeline`/`EDL`), `@video-maker/local-store` (SQLite: proyectos,
  organización, conversación/sesión del productor, jobs, configuración), `@video-maker/producer-tools`
  (contrato/prompt del productor, servidor MCP `studio`), y `@video-maker/media-local` /
  `@video-maker/composition-remotion/render` — estas dos **exclusivamente por `await import()`
  dinámico** en `src/deps/node-render-api-dependencies.ts`; en el resto del proyecto son `import type`.
- Dependencias que ya estaban en la raíz y usa el storyboard con OpenRouter: `ai` 7.0.113 y
  `@openrouter/ai-sdk-provider` 3.1.0; `@video-maker/motion-graphics` (alias en vite y tsconfig) y
  `hyperframes@0.8.139` (corre con `process.execPath` + `ELECTRON_RUN_AS_NODE` bajo Electron) para el job `motion`.
  HTTP saliente de YouTube sólo a accounts.google.com, oauth2.googleapis.com y www.googleapis.com.
- **Binarios y servicios externos**, todos por puertos inyectables y ninguno en `package.json`:
  `ffmpeg`, `ffprobe`, `whisper-cli` + su modelo, un CLI de voz **sherpa-onnx** (`TTS_CLI_PATH` +
  `TTS_VOICES_DIR`, reemplazó a Piper), y `claude` (Claude Code CLI, **sin API key**) para el
  storyboard y, cuando el motor efectivo del productor es Claude, para el productor. El productor
  también corre contra **OpenRouter** (API HTTP, key en el llavero de macOS, nunca en un payload).
- Vitest 4 sobre toda la lógica no-I/O, con alias a `src/` de las libs del workspace. La suite corre
  **sin** ffmpeg, ffprobe, whisper-cli, el CLI de voz, claude, OpenRouter ni Chrome, y sin red.
- Tags Nx: `["scope:engine", "type:app"]`. Targets: `lint`, `test`, `build`, `serve`, `bundle`.
- **El alias de una lib del workspace hay que declararlo en CUATRO resolvedores:**
  `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts` (Vitest), `webpackOverride`
  de Remotion (render), y **`SWC_NODE_PROJECT=tsconfig.base.json` en toda invocación directa del
  binario en dev**. Sin la cuarta el proceso ni arranca, y `lint`/`test`/`build` verdes no lo
  detectan. El bundle empaquetado (CJS, workspace packages inlineados) no depende de esto.

## 3. Convenciones

- **Una sola frontera de proceso** (`src/main.ts`): el único archivo que toca `process`, `console` y
  las señales del sistema, salvo el watchdog del padre (`src/process/parent-watchdog.ts`, mata el
  árbol de procesos si `VIDEO_MAKER_PARENT_PID` desaparece — lo usa Electron). Verificado por grep al
  cerrar cada ciclo: `process.`, `console.`, `node:fs`, `node:crypto` y `node:child_process` sólo
  aparecen ahí y en `src/deps/node-render-api-dependencies(.spec).ts`.
- **Todo el I/O entra por puertos inyectables** (`RenderApiDependencies`), armados en un único
  adaptador de producción `createNodeRenderApiDependencies(env, store)`. **No hay puerto de
  borrado:** conservar los intermedios (D-8) es una propiedad del tipo, no una decisión de runtime.
- **Puertos vs estado vivo, explícito:** `RenderApiDependencies` son puertos **sin estado**;
  `RenderApiRuntime` (`src/http/render-api-runtime.ts`) es el estado vivo por servidor (`jobs`,
  `producerTurns`, `producer`, `uploadSerializer`), cuarto parámetro obligatorio de `handleRequest`.
  **Ningún estado de módulo sobrevive en el subproyecto** (D-23); la cola de jobs y la
  conversación/sesión del productor además persisten en SQLite (`deps.localStore`), sobreviviendo a
  un reinicio.
- **Los jobs son una unión discriminada por `kind`** (`render` · `montage` · `storyboard` · `voice` ·
  `photo-aroll` · `motion` · `publish` · `review` · `reference`) con etapas propias por tipo. Agregar un miembro rompe la exhaustividad en **todos**
  los call sites, incluidos handlers que la task en curso no lista: es la red de seguridad, no un
  costo.
- **El productor rutea cada turno a un motor efectivo**, Claude CLI u OpenRouter, elegido por
  configuración (`EP-037`..`EP-040`); el adaptador OpenRouter emite el mismo protocolo `stream-json`
  que el CLI, así que persistencia y resúmenes de turno no distinguen motor. El storyboard **siempre**
  usa su propio agente Claude. **El modelo viaja por request, no por arranque**: `POST
  …/producer/messages` y los jobs `storyboard`/`voice` aceptan `model?`, validado contra
  `runtime.producer.models` (`PRODUCER_MODEL_INVALID` / `JOB_MODEL_INVALID`, 422); el agente de
  storyboard nunca se invoca sin `--model` (`CLAUDE_CLI_MODEL` default `sonnet`); el job `voice`
  valida el campo y lo descarta, porque la síntesis es local.
- **El job `montage` parametriza formato, fuente de habla y estilo de captions**: `format` (los
  cuatro `OutputPreset`, default `reels-9x16`), `voice: 'aroll' | 'script'` (default `aroll`) y
  `captionStyle` (`CaptionStyle | null`; `undefined` ⇒ `null`, decide el preset de montaje), los
  tres validados **antes** de registrar el job — `script` sin `work/voice/voice.wav` es
  `409 MONTAGE_VOICE_TRACK_NOT_FOUND`, un `captionStyle` fuera de `CAPTION_STYLES` es
  `422 MONTAGE_CAPTION_STYLE_INVALID`. `voice` está **sobrecargado por `kind`**: en un job `voice`
  es el id del modelo de voz, en un `montage` es la fuente de habla. `captionStyle` queda persistido
  en `work/timeline.json`, así que `PUT /projects/:slug/timeline` puede cambiarlo y un `render`
  pelado lo toma sin replanificar; `MontageJobReport` siempre lo resuelve.
- **El job `storyboard` corre sobre el motor efectivo** (`ai/effective-ai-agent.ts`, por request con
  `resolveEffectiveProducerEngine`): `claude-cli-ai-agent` o `openrouter-ai-agent` (segundo `AiAgentPort`, salida
  estructurada; mapea a `OPENROUTER_KEY_MISSING`, `OPENROUTER_FREE_QUOTA_EXHAUSTED`, `AI_AGENT_RATE_LIMITED`,
  `AI_AGENT_INVALID_OUTPUT`, `AI_AGENT_FAILED`). En OpenRouter usa el `model` del job sólo si es un id conocido
  (`producer/openrouter-model-knowledge.ts`). Si la propuesta no pasa `StoryboardProposalSchema`, un reintento de
  reparación con los issues de Zod suma el uso de las dos llamadas y el reporte trae `repaired`. En
  `node-render-api-dependencies.ts` el `aiAgent` se cierra sobre `deps` (resolución perezosa). Los procesos hijos
  nunca reciben `ANTHROPIC_API_KEY` (el CLI usa la suscripción). El storyboard motion pide `--effort low` y 15 min
  por llamada.
- **El job `voice` tiene dos entradas**: el storyboard, o un guion suelto (`scriptText` XOR
  `scriptPath`, una frase por línea, más `gapMs` default 900) que sintetiza un wav por frase, los
  concatena en `work/voice/voice.wav` (48 kHz mono) y los describe en
  `work/voice/script-manifest.json` con `source: 'script'`. Los paths de la pista de guion se
  **re-exportan de `@video-maker/auto-montage`**, que es quien también los lee desde el montaje.
  **La transcripción es por línea** (`work/voice/whisper/line-NN.wav`), no del wav concatenado: las
  palabras de cada frase se desplazan al `startMs` de su placement y se acotan a su ventana; si
  Whisper falla o no deja palabras dentro, el texto de esa línea se reparte parejo.
  `voice.words.json` es la unión ordenada (`segments: []`). El guion entiende **marcas de tiempo**:
  `hasVoiceScriptTimeMarks` decide un flujo de dos pasadas
  (sintetizar a velocidad natural → planificar y decidir qué líneas acelerar → resintetizar sólo
  esas → planificar de nuevo con `allowSpeedUp: false`, que fija `startMs`/`endMs`/`overflowMs`); un
  guion sin marcas usa el flujo simple de siempre. El reporte del job **no** publica si era
  cronometrado ni el overflow total — se lee de `work/voice/script-manifest.json`.
- **Dirección de voz** (`voice/voice-direction-store.ts`, `GET/PUT /projects/:slug/voice/direction`): el job voice por
  guion la aplica por línea respetando la ventana `[m:ss]`; `sceneDirections` (por `sceneId` de
  `work/storyboard.json`) la aplica a la voz del storyboard narrado y su hash la incluye cuando existe. El job
  montage acepta `musicMode`/`musicFloorDb`.
- **El job `motion`** (`jobs/run-motion-pipeline.ts`, `motion-job-params`, `motion-job-progress`,
  `motion-pipeline-observer`; adaptadores `deps/motion-pipeline-adapters.ts`, `hyperframes-cli.ts`): fases
  storyboard | video | all; etapas storyboard/voice/plan/compose/render; misma cola que `render`; trabajo en
  `<proyecto>/work/motion/`, salida `out/<output>`. `POST /projects {slug, mode}` (default footage; motion crea
  `motion/`); `mode` en lista y detalle; brief y storyboard (`GET/PUT /projects/:slug/motion/{brief,storyboard}`)
  validados con la lib (`BRIEF_INVALID`, `BRAND_NOT_FOUND`, `STORYBOARD_INVALID`, 409 `MOTION_PROJECT_REQUIRED`).
  `GET /projects/:slug/motion/overview` (`src/motion/`: storyboard, timeline, voz por escena con `stale`, último
  video con créditos y `outdated`, `measuredBoxes`); `PUT /motion/storyboard` rechaza fotos que no sean
  `images/<archivo de raw/images>` o `brand:<clave>`; regenerar el storyboard conserva `music.volume`;
  `ASSET_MISSING` agrega el formato aceptado.
- **Muestras**: `render` y `motion` aceptan `sample {seconds 8-20}`; salida `out/<id>.sample.mp4`, reporte
  `sample: true`, sin job de revisión, excluida de publicar y de la vista motion. `jobs/sample-files.ts` decide si un
  mp4 es muestra por el reporte del job (el sufijo es sólo respaldo); `RenderJobSummary` y `GET .../generated`
  exponen `sample`.
- **Marcas** (`src/brands/`: `brand-library`, `brand-palette`, `wordmark-svg`, `brand-preview`, `brand-fonts`,
  `apply-project-brand`, `project-brand-context`, `project-brand-resolver`, `rasterize-svg`; `store/project-brand.ts`;
  `deps/svg-rasterizer.ts`): `GET/POST /brands`, `GET/PUT/DELETE /brands/:id`, `PUT /brands/:id/files/:kind/:name`,
  `GET /brands/:id/files/*`. Marcas del usuario en `BRANDS_ROOT` (default `dirname(MEDIA_ROOT)/brands`) más las
  incluidas de sólo lectura (`409 BRAND_READ_ONLY`); duplicar fija todas las variables de la original; borrar mueve
  a `.trash/`; `GET /motion/brands` lista ambas raíces con `source`. El confinamiento de `ObjectStorage` admite
  `brandsRoot` y `<motionAssetsRoot>/brands`. `POST /brands/:id/preview` compone apertura y cierre con timeline
  sintético en `<brandsRoot>/.preview/<id>/`, serializado por marca (`runtime.brandPreviewSerializer`); el HTML de
  vista previa fija el lienzo 1920×1080 escalado. `POST /brands/:id/fonts` baja Google Fonts por `deps.fetchRemote`
  (sólo fonts.googleapis.com / fonts.gstatic.com). Errores `BRAND_UNKNOWN` 404, `BRAND_EXISTS`, `BRAND_READ_ONLY` 409,
  `BRAND_MANIFEST_INVALID`, `BRAND_FILE_INVALID`, `BRAND_FONT_UNKNOWN` 422, `BRAND_FONT_DOWNLOAD_FAILED` 502,
  `BRAND_LOGO_RASTERIZE_FAILED` 503. Proyectos con marca: `POST /projects` acepta `brand`, `GET` devuelve `brand` y
  `brandMissing`, `PUT /projects/:slug/brand`; guardar el brief motion sincroniza la marca; `applyProjectBrand` deja el
  logo en `raw/logo/brand-<id>.png` catalogado (SVG rasterizado con el Chrome headless de Remotion vía el puerto
  `rasterizeSvg`) y las fuentes en `work/brand/fonts/`, y reemplaza el logo del timeline al cambiar de marca. El
  detalle trae `captionTheme`; `captionStyle: 'brand'` sin marca → 422; el job de voz sin `voiceId` usa la voz y
  velocidad de la marca si está instalada. El contexto del productor trae la marca del proyecto.
- **Material libre** (`src/media-search/`): Wikimedia Commons (`filetype:video|bitmap`, licencia comercial, video
  mp4/webm, imagen jpg/png/webp) + NASA Image and Video Library (sólo ítems sin crédito o de NASA; `~medium.mp4`,
  `~large.jpg` con fallback a `~orig`), sin key. `free-media-search.ts` **intercala** las fuentes antes de recortar a
  `maxResults` (concatenar dejaba a NASA en 0); caché por proyecto; `import-free-media.ts` (hosts
  `upload.wikimedia.org`/`images-assets.nasa.gov`, tope 200 MB video / 30 MB imagen, temp + promote a `raw/broll` o
  `raw/images`); `commons-shared.ts` y `download-shared.ts` compartidos con `music/`. `work/credits.json`:
  `MediaCreditEntry` con `kind: music|video|image`. EP-046 `GET /projects/:slug/media/search`, EP-047 `POST
  .../media/import`, EP-048 `POST .../images/preview` (JPEG ≤1280 px en `work/frames/previews/`; acepta `brand:<clave>`
  y registra lo visto en `work/producer/viewed-images.json`). Puerto `resizeImage` (hermano de `extractFrame`):
  **nunca `-ss` sobre una imagen fija** (el demuxer `image2` reporta duración casi nula, `-ss 0` salta el único frame y
  ffmpeg sale 0 sin escribir nada).
- **Bandeja de assets** (EP-042..045; `store/asset-inbox.ts`, `http/handlers/asset-inbox-handler.ts`): subir a
  `raw/inbox/`, listar pendientes, confirmar con rol, descartar. La propuesta de rol es determinista a partir del
  probe y el nombre (`store/propose-asset-role.ts`, razones como códigos estables que traduce la web); confirmar mueve
  a `raw/<rol>/` y cataloga por el mismo camino que una subida (`store/ingest-asset-into-catalog.ts`). Códigos
  `INBOX_ASSET_NOT_FOUND` 404 y `UNSUPPORTED_MEDIA_TYPE` 415; el contexto del productor incluye los pendientes.
  `scripts/esbuild-node-bundle.mjs` define `process.env.NODE_ENV="production"`.
- **Revisión automática de renders** (`src/review/`: reglas, umbrales, collector de entradas footage/motion con puertos
  de medición inyectables, adaptador ffmpeg, `scene-frames`, `scene-frame-plan`, `motion-scene-voices`,
  `motion-sfx-cues`, `caption-layout-facts`, `caption-safe-zone-rule`; `jobs/run-review-pipeline.ts`): job `review`
  (collect → measure → rules → write) que deja `out/<render>.review.json`, encolado solo al terminar `render` y
  `motion`. `GET /projects/:slug/reviews` (lista o `?file=`); `reviewStatus` en las opciones de publicación y 409
  `RENDER_REVIEW_FAILED` al publicar un render `fail` salvo `ignoreReview: true` (persistido). Margen voz/música por
  tramo: crítico < 10 dB, sugerencia < 15 dB, sumando los `sfx-*` del `index.html` motion; regla `caption-safe-zone`
  contra isotipo, chat de la UI y recuadros pip (geometría importada de `@video-maker/timeline-core`). Duración
  medida por el stream de video. El job review de motion extrae 1 a 5 cuadros por escena
  (`out/<render>.review/scene-NN.jpg`), marca `visual-not-reviewed` y compara la duración con la propuesta aprobada;
  `PUT /projects/:slug/reviews/visual` exige todos vistos (`VISUAL_REVIEW_NOT_VIEWED`, `VISUAL_REVIEW_INVALID`);
  `MOTION_MUSIC_TRACK_VOLUME` viene de motion-graphics.
- **Propuesta del proyecto** (`src/proposal/`: estimate-production, estimate-engine, job-history, proposal-store,
  proposal-paths; `jobs/sample-job-params.ts`): `work/producer/proposal.json` con `GET/PUT /projects/:slug/proposal` y
  `POST .../proposal/approve` (`PROPOSAL_NOT_FOUND`); el texto del productor no puede escribirla (`PATH_NOT_WRITABLE`).
  Estimación recalculada en cada GET con la mediana de segundos de proceso por segundo de video del historial de jobs:
  `MIN_HISTORY_SAMPLES = 3`; fuentes `history-format` → `history-mode` → `history-studio` (`rough: true`) →
  `default` (`rough: true`). `GET/PUT /projects/:slug/material-review` (`MATERIAL_NOT_VIEWED`,
  `MATERIAL_REVIEW_INVALID`; `src/material/`); la propuesta adjunta `materialWarnings`.
- **Referencias** (`src/reference/`, puerto `ReferenceMeasurements`, `build-reference-brief.ts`;
  `jobs/run-reference-pipeline.ts`): job `reference {file}` (probe/scenes/transcribe/keyframes/persist) deja
  `work/reference/<nombre>.brief.json` y `work/reference/<nombre>/scene-NN.jpg`; `GET /projects/:slug/references` y
  `.../references/:name`; `REFERENCE_FILE_INVALID` 422, `REFERENCE_FILE_NOT_FOUND`/`REFERENCE_NOT_FOUND` 404; rol
  `reference` en el store y en `assetCounts`.
- **Publicación en YouTube** (`src/youtube/*`, `jobs/run-publish-pipeline.ts`, `publish-job-*.ts`,
  `deps/oauth-loopback.ts`, handlers `youtube-integration-handler.ts`, `youtube-publish-handler.ts`,
  `publish-queue-handler.ts`): OAuth de escritorio con PKCE y redirect local de un solo uso (puerto
  `startOAuthLoopback`); cliente y refresh token en `secretStore`, canal en settings; la conexión pide también
  `youtube.force-ssl` (listas; un 403 por scope insuficiente es `YOUTUBE_NOT_CONNECTED` con pista de reconectar).
  Rutas `GET`/`POST /integrations/youtube/playlists` y `POST .../playlists/:playlistId/items`. Job `publish`: subida
  reanudable en trozos de 8 MiB con `Content-Range`, sesión guardada para reintentos, miniatura y lista (`playlistIds[]`),
  créditos de música agregados una vez a la descripción, `publishAt` → privado programado. El borrador de metadatos lo
  genera el motor del productor con los textos en pantalla del storyboard motion (`onScreenTextsOf`) y escribe los
  nombres como aparecen en pantalla (`writtenNames`: "Isi Pro" → "Easy Pro"), no como los deletrea la voz. Tabla
  `publications` y `lastPublication` en `GET /projects`. Errores `YOUTUBE_CLIENT_MISSING`, `YOUTUBE_NOT_CONNECTED` 409,
  `YOUTUBE_UPLOAD_FAILED` 502, `YOUTUBE_QUOTA_EXCEEDED` 429, `PUBLISH_FILE_INVALID` 422. `fetchRemote` acepta método,
  cuerpo y `redirect: 'manual'`. Cola de publicación EP-067..EP-073 (`/publish-queue*`,
  `/integrations/youtube/category-playlists`; `LocalStorePort.publishQueue`):
  `publish-queue-scheduler.ts` (tick 60 s, un publicador, límite diario de 24 h, cuota → +1 h a toda la cola, sin
  conexión → pausa, ya publicado → `already-published`, listas por categoría + general) arranca con el server y
  **nace pausada**; reactivarla es una acción del dev. `producer-stream-events` describe las tools de publicación y
  resume `patch_timeline`.
- **El productor no tiene shell propio**: `claude -p` se lanza con `--tools ""`, `--strict-mcp-config`
  y un `--mcp-config` inline que arranca el servidor MCP `studio` de `libs/producer-tools`, acotado
  al proyecto (`--allowedTools mcp__studio`), `cwd` estable y vacío. Agregar una capacidad nueva es
  agregar una tool MCP, no ensanchar una lista blanca de `Bash`/rutas. `store/producer-writable-paths.ts`
  es la única puerta de rutas que el productor puede escribir (relativas, sin `..`, realpath dentro
  del proyecto aunque no exista; `work/producer/**` + `work/credits.json`).
- **El turno del productor NO es un job** (D-1 de `spec-015`): el agente encola `montage`/`render`/
  `photo-aroll` en esta misma API y espera su resultado, así que dentro de una cola de concurrencia 1
  se bloquearía solo. Vive en `producerTurns`, la exclusión es **por proyecto** y la cancelación
  **mata el proceso hijo** en vez de ser cooperativa.
- **La cancelación de un job es cooperativa y el estado vigente gana sobre el resultado del
  pipeline**: cancelar durante `verify` da `canceled` con `report: null` aunque el MP4 exista. Los
  checkpoints van **entre** llamadas opacas, nunca dentro de una.
- **El orden del pipeline no es conmutable**: `renderTimeline(..., { audio: 'muted' })` →
  `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. El render mudo es obligatorio: sin
  él, el entregable sale con el audio de Remotion **encima** de la mezcla masterizada.
- **Todo payload de máquina en inglés** (D-4): `code`, `stage`, `resource`, `expected`, `hint`.
  Ningún payload expone `.stack`, rutas absolutas del host, ni el `message` de una lib que lleve la
  ruta de un binario, ni el `stderr` de un proceso externo, ni una key de OpenRouter. `toErrorPayload`
  omite los campos nulos en vez de emitir `null`.
- **La traducción de errores es estructural por `code`**, nunca por `instanceof` de la lib
  (`translateEngineError`, `translateStoreError`, `translateMontageError`, `translateVoiceError`,
  `translateProducerError`). El fallo de un proceso externo es `502`, no `500`.
- **Cada ruta del pipeline lleva su par `{ path, resource }`**: `path` es de filesystem, `resource`
  es relativo al proyecto y es lo único que puede salir en un payload.
- **`withinTolerance: false` no es un fallo** (D-7): se publica el entregable y se reporta el delta.
- **`publicDir` = raíz del proyecto de medios, nunca `raw/`**; los intermedios van a
  `work/renders/<renderId>/` y el entregable a `out/<renderId>.mp4`.
- **Toda ruta se confina a `mediaRoot`**: la que se escape es `ASSET_PATH_INVALID`.
- **Todo path que cruza a un puerto de media va ABSOLUTO** (D-30 y D del `cycle-01` de `spec-009`):
  pasar `projectRoot` como `cwd` alcanza para el binario pero **no** para el wrapper, que lee su
  JSON con `readTextFile` contra el cwd del proceso de la API.
- **Los artefactos de `work/` se escriben con los escritores de `auto-montage`**
  (`serializeMontageDocument`, `writeTimeline`, `writeEditDecisionList`), nunca con un
  `JSON.stringify` propio: es lo que sostiene la paridad byte a byte con la CLI (D-16).
- **El store de assets también borra** (`EP-027`): mismo confinamiento y mismo mutex por slug que el
  upload (`runtime.uploadSerializer`), así que un delete nunca se intercala con una subida del mismo
  proyecto. `409 ASSET_IN_USE` si `work/timeline.json` lo referencia (`findTimelineAssetReferences`),
  salvo `?force=true`. **Nada se borra hasta que pasaron todas las verificaciones**: el catálogo se
  lee antes de tocar el disco. El borrado no conoce derivados (`work/renders/`, `work/edl.json`,
  `out/`): quedan huérfanos porque no hay índice inverso de artefacto → asset; sólo la transcripción
  del asset se limpia porque el catálogo la modela por asset.
- **`GET /projects/:slug/generated` (`EP-028`) es ciego al contenido**: recorre recursivamente
  `work/voice`, `work/producer` y `out` (`GENERATED_ROOTS`, ninguna otra raíz), no parsea ni borra;
  los bytes los sigue sirviendo `EP-011`. Una raíz ausente aporta cero entradas, nunca falla.
- **El catálogo de voces no infiere nada que el modelo no documente** (ni género, ni edad, ni
  carácter): `language`, `quality` y `label` salen del sidecar de cada voz bajo `TTS_VOICES_DIR`, y
  del nombre del archivo sólo cuando el sidecar falta o está corrupto. `GET /voices/:voiceId/preview`
  (`EP-026`) sintetiza una frase fija en español, la cachea fuera de `mediaRoot`
  (`voicePreviewCache` es un puerto propio, no `deps.storage`) e invalida por `mtime` del modelo —
  **no** por el código: bumpear `VOICE_PREVIEW_REVISION` es obligatorio al tocar la frase. El
  preview corre en un `createKeyedSerializer` por voz, **fuera de la cola de jobs**, mismo
  fundamento que el turno del productor.
- **El acceso HTTP es local por defecto, opcionalmente detrás de un token**: con
  `RENDER_API_ACCESS_TOKEN` seteado (empaquetado Electron), toda ruta exige la cookie `vm_session` o
  el header `x-studio-token` más un `Host` local (`http/local-access-guard.ts`); sin la variable no
  hay guardia. Con `RENDER_API_WEB_ROOT` seteada, el mismo proceso sirve la web estática y la API
  queda bajo `/api` (`GET /health` sin prefijo es la excepción). El entorno de un proceso hijo
  (`claude -p`, el servidor MCP, los binarios de media) **nunca es `process.env` completo**:
  `config/child-process-env.ts` arma la lista blanca.
- **El system prompt del productor exige decir en qué pantalla quedó cada artefacto** al entregar
  (`preview`/"Generated" para el video, `voice` para la narración, `storyboard` para el guion) y
  nunca contestar "dónde está" con una ruta. Para el logo, enseña a leer `pix_fmt` con
  `ffprobe -show_streams` y preferir el archivo con canal alfa cuando hay más de uno en
  `raw/logo/` — un PNG `rgba` con el arte sobre un recuadro blanco opaco pasa el filtro igual, así
  que el chequeo real lo hace el humano en el preview.
- **`apps/render-api/eslint.config.mjs` no existe** (D-9): el hook `config-protection` del harness
  del dev bloquea cualquier archivo de ese basename y rodearlo con `Bash` anularía el guardrail.
  `@nx/eslint:lint` resuelve el flat config de la raíz, así que el proyecto sí se lintea y los
  boundaries se cumplen por el fallback de `type:app`.
- **Los `*.spec.ts` NO se typechequean** (`tsconfig.lib.json` los excluye y Vitest no tipa): un
  fixture sin discriminante cae en la rama equivocada con `lint` y `build` en verde. Tipar los
  fixtures contra el tipo de producción, nunca compensarlo con un guard de runtime.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- **El guion copiable de verificación real vive en `apps/render-api/README.md`**, nunca sólo en un
  `architect.md`.

## 4. Trampas de operación

- Reiniciar el studio sólo con la cola de publicación frenada.
- `GET /projects/:slug/assets` falla con `CATALOG_UNREADABLE` si la carpeta del proyecto se renombra fuera de la API
  (el slug de `work/catalog.json` no coincide).
- El margen voz/música de motion no contempla whoosh/riser/impacto; la zona segura de subtítulos se evalúa por el
  contenedor.
- El turno de producción completa supera los 30 min: pendiente partirlo.
- El progreso del job `motion` queda en 80 % al terminar la fase video.

## Lecciones específicas

- Servir HyperFrames fuera de su reproductor exige fijar el lienzo a `data-width`×`data-height`.
- Una carpeta copiada en `media/` se importa sin modo: los proyectos de prueba se crean por API con `mode`; `media/motion/` no es un proyecto.
- La web debe aceptar el reporte de la fase storyboard con `path: null`.
