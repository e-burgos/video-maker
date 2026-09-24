# Context Prompt — apps/render-api

> Entry point para agentes que trabajen sobre `apps/render-api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: consolidado hasta spec-e-burgos-017-desktop-app cycle-04 | Fecha: 2026-09-24
> Consolidado al cerrar `cycle-04` de `spec-e-burgos-017-desktop-app` (fundió los fragmentos de
> `FIX-009-004` y de `cycle-01`..`cycle-04`).

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario)
- **Estado:** **completo.** 41 rutas, 112 códigos de error, 116 archivos de test. Verificado contra
  binarios reales (Remotion, FFmpeg, whisper-cli, el CLI de voz sherpa-onnx y `claude -p`) en smokes
  manuales, nunca en CI. `cycle-04` de `spec-017` además corrió el flujo de producción real
  empaquetado con OpenRouter.
- **Specs que la gobiernan:** `spec-003-kinetic-captions` (`FIX-003-003` sumó `captionStyle` a
  `montage`) · `spec-005-render-service` (la creó; `FIX-005-001` sumó `EP-027`) ·
  `spec-006-web-studio` (`FIX-006-001` sumó `EP-028`) · `spec-007-web-montage` (job `montage`) ·
  `spec-008-ai-storyboard` (job `storyboard`, puerto `aiAgent`) · `spec-009-voice-over` (job `voice`;
  `FIX-009-001` guion suelto, `FIX-009-002` marcas de tiempo, `FIX-009-004` transcripción por línea) ·
  `spec-014-production-quality` (guion y logo en `montage`) · `spec-015-studio-producer` (productor
  conversacional; `FIX-015-001` modelo por request) · `spec-016-studio-usability` (catálogo/preview de
  voces, `EP-019`/`EP-026`) · **`spec-017-desktop-app`** (empaquetado Electron: `cycle-01` productor a
  MCP sin shell + job `photo-aroll`, `EP-029`..`EP-035`; `cycle-02` persistencia SQLite +
  `EP-036` retry; `cycle-03` bundle CJS, web bajo `/api`, guardia de acceso, Piper → sherpa-onnx;
  `cycle-04` motor OpenRouter del productor, `EP-037`..`EP-041`).
- **Rol en el sistema:** la puerta HTTP del motor. Es **el único subproyecto del monorepo que puede
  depender a la vez de `libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`)**:
  los `depConstraints` del `eslint.config.mjs` raíz impiden que esas dos libs se importen entre sí, y
  el tag `type:app` cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`. Por eso
  la orquestación `render → mix → mux → verify` en una sola llamada vive acá. (`tools/render-cli`,
  con tags `scope:engine`/`type:tool`, cae en el mismo fallback y desde `spec-015` hace los mismos
  cuatro pasos.)
- **Depende de:** `@video-maker/timeline-core`, `@video-maker/auto-montage`,
  `@video-maker/local-store` (persistencia SQLite), `@video-maker/producer-tools` (MCP del
  productor), `@video-maker/media-local` y `@video-maker/composition-remotion/render` (subpath
  `/render` exclusivamente, vía `await import()`). **Cero dependencias npm propias.**
- **No contiene lógica de motor propia:** si un cálculo hace falta, va a una lib. Acá vive sólo el
  transporte HTTP, la orquestación de llamadas y la traducción de errores a payload de máquina.
- **Consumidor:** `apps/web` (Web Studio, servida por esta misma app cuando `RENDER_API_WEB_ROOT`
  está seteada) y `apps/desktop` (Electron), que consumen HTTP y **no** exit codes.

## Mapa del código

```
src/
  main.ts                      única frontera de proceso (env, señales, exitCode, stdout/stderr)
  server-register.cjs          loader @swc-node/register acotado a .ts (sólo dev)
  process/                     watchdog del padre (VIDEO_MAKER_PARENT_PID), limpieza de Chrome huérfano
  secrets/                     keychain-secret-store (key de OpenRouter en el llavero de macOS)
  config/                      server-config · store-config · ai-agent-config · producer-config ·
                               voice-preview-config · remotion-config · child-process-env ·
                               recommended-openrouter-models
  deps/                        contrato de puertos + puerto ObjectStorage + adaptador de producción
  ai/                          claude-cli-ai-agent (request/response con --json-schema, storyboard)
  engine/                      nombres de módulos de motor y de binarios de media
  errors/                      112 códigos, etapas por tipo de job, PipelineStageError y traducciones
  pipeline/                    runRenderPipeline (prepare → render → mix → mux → verify) + observer
  jobs/                        unión discriminada (render|montage|storyboard|voice|photo-aroll),
                               máquina de estados pura, cola FIFO, job-persistence (SQLite),
                               run-photo-aroll-pipeline (Ken Burns + mux)
  storyboard/                  documento, inventario, prompt y export numerado de prompts
  voice/                       rutas, formatos, catálogo/preview de voces, store del manifest,
                               transcribe-voice-script-lines (por línea)
  producer/                    conversación persistida, prompt del sistema, mapeo del stream-json,
                               puerto ProducerAgent + adaptadores Claude Code/OpenRouter, registro de
                               turnos, producer-mcp-config, openrouter-model-catalog, producer-history
  store/                       slug · asset-path · layout · catalog-merge · project-assets ·
                               project-scope · montage-preconditions · serialize-by-key ·
                               timeline-asset-references · producer-writable-paths ·
                               import-legacy-media (import idempotente de `media/` a SQLite)
  http/                        router, handlers (incl. generated, voice-preview, probe/frames/
                               project-text/asset-copy/music, producer-settings, openrouter-models),
                               static-web-handler, local-access-guard, health, runtime, servidor
  __fixtures__/                call-log ordenado y dobles de todos los puertos
```

## Contrato y comportamiento que hay que respetar

- **41 endpoints, registrados campo a campo en `sdd/api.json`** (`EP-001`..`EP-041`). Es el contrato
  que `apps/web`/`apps/desktop` consumen: ningún campo publicado cambia de nombre, tipo ni semántica
  sin un ciclo que lo declare. Toda aserción de forma se hace con `Object.keys(body).sort()` contra
  la interfaz, nunca campo por campo contra lo que el handler ya emite.
- **`DELETE /projects/:slug/assets/:role/:filename` (`EP-027`)** borra un asset bajo el mismo mutex
  por slug que el upload (`runtime.uploadSerializer`): `404 ASSET_NOT_FOUND`; `409 ASSET_IN_USE` con
  la lista de usos en `hint` (`assets[]`, clip de cualquier pista, `logo.assetId`) cuando
  `work/timeline.json` lo referencia, y `?force=true` borra igual devolviendo
  `{ deleted, timelineReferences }`. Saca el archivo, su entrada de `work/catalog.json` y la
  transcripción a la que apuntaba. La timeline no se repara sola tras un `force`.
- **`GET /projects/:slug/generated` (`EP-028`)** recorre `work/voice`, `work/producer` y `out`
  (`GENERATED_ROOTS`) y devuelve `{ slug, roots, files: [{ path, sizeBytes, modifiedAtMs }] }`, ciego
  al contenido; los bytes los sigue sirviendo `EP-011`.
- **`GET /voices` (`EP-019`)** publica por voz `language { code, region }`, `quality`, `label`,
  `description` y `previewUrl`, derivado del sidecar de cada modelo bajo `TTS_VOICES_DIR` (o del
  nombre del archivo si el sidecar falta). **`GET /voices/:voiceId/preview` (`EP-026`)** sintetiza
  con el CLI de voz una frase fija en español (~4 s), la cachea (`voicePreviewCache`, fuera de
  `mediaRoot`) y la sirve como `audio/wav` con `Cache-Control: public, max-age=86400`; `404
  VOICE_NOT_FOUND` / `503 VOICE_MODEL_UNAVAILABLE`.
- **El productor gana rutas MCP-orientadas y un quinto job** (`EP-029`..`EP-035`):
  `probe`/`frames`/`project-text` (GET/PUT)/`asset-copy` respaldan las tools del servidor MCP
  `studio`; `music` busca y descarga contra Commons, cacheado por proyecto en
  `runtime.musicSearchCache`; el job `photo-aroll` arma Ken Burns por línea del
  `script-manifest.json` y mux la voz a `raw/aroll/<output>`. **`EP-036` retry** crea un job nuevo
  con los mismos parámetros (`retry_of`).
- **El productor tiene motor configurable** (`EP-037`..`EP-040`): Claude CLI u OpenRouter; la key de
  OpenRouter vive en el llavero de macOS (`secrets/keychain-secret-store.ts`) y nunca vuelve en un
  payload. **`GET /openrouter/models` (`EP-041`)** sirve el catálogo en vivo (caché 1 h, sirve stale)
  con recomendados marcados (`config/recommended-openrouter-models.ts`, un `isDefault`: hoy DeepSeek
  v4.1 Flash). El storyboard sigue usando siempre su propio agente Claude.
- **`GET /health`** reporta módulos de motor, los binarios de media (por nombre lógico y variable de
  entorno, **nunca** por ruta resuelta: `ffmpeg`/`ffprobe`/`whisper-cli`/el CLI de voz sherpa-onnx),
  `capabilities`, `jobs: { running, queued }` y `store: { schemaVersion, dbPath }`. El bloque `jobs`
  es un contador de carga: **nunca** afecta el cálculo `ok`/`degraded`. `capabilities.producer` sale
  de una sonda del binario de Claude Code y **tampoco** entra en ese cálculo: `claude` no está en
  `binaries` porque volvería `degraded` toda máquina sin Claude Code, CI incluido (D-12 de
  `spec-008`). El CLI de voz sí está, y una máquina sin él (o sin voces bajo `TTS_VOICES_DIR`)
  reporta `degraded`.
- **Cola de jobs:** FIFO, **concurrencia 1**, para los cinco `kind`, **persistida en SQLite**
  (`@video-maker/local-store`) así que sobrevive a un reinicio. Seis estados
  (`queued`/`running`/`canceling`/`succeeded`/`failed`/`canceled`). Al arrancar, todo job que quedó
  sin terminar pasa a `failed` con `JOB_INTERRUPTED`; `EP-036` lo reintenta. Cancelación
  **cooperativa**: no se señala ni se mata ningún proceso. Un job fallado es `200` con el error
  tipado **en el body**, no un status HTTP de error.
- **El productor corre FUERA de la cola** (`EP-022`..`EP-025`): un turno activo por proyecto
  (`409 PRODUCER_TURN_ACTIVE`), eventos `text`/`tool`/`status` derivados del `stream-json` del motor
  efectivo (Claude Code u OpenRouter) a granularidad de mensaje, sugerencias de 2 a 4 acciones
  extraídas del bloque ```suggestions, y `DELETE` que **mata** el hijo cuando el motor es Claude
  (`202`, `canceled` cuando el proceso muere de verdad). **Conversación y sesión persisten en SQLite**
  (`@video-maker/local-store`); `conversation.md` y `turns/<turnId>.jsonl` siguen como archivos en
  `work/producer/`. Al arrancar se importa de `media/`, idempotente y de solo lectura, lo que hubiera
  quedado como legado en disco (`store/import-legacy-media.ts`).
- **El `Timeline` se snapshotea al crear el job**: un job siempre rinde el documento que existía
  cuando se creó, nunca un `PUT` posterior.
- **Upload atómico**: validación pura completa **antes del primer puerto**, luego `writeTemporary`
  en `work/.uploads/` → `stat` → `promoteTemporary` (rename). Un fallo de `probeAsset` **no** borra
  el archivo: registra la falla en `catalog.probeFailures`.
- **Bytes idénticos a los de la CLI**: todo artefacto de `work/` se escribe con los escritores de
  `@video-maker/auto-montage` (D-16).

## Variables de entorno

| Variable | Default | Regla |
| --- | --- | --- |
| `RENDER_API_HOST` | `127.0.0.1` | Cualquier string no vacío se usa tal cual. El default nunca escucha fuera de loopback. |
| `RENDER_API_PORT` | `4310` | Entero `0..65535`. Inválido ⇒ aborta con `SERVER_CONFIG_INVALID` (exit 78), nunca cae al default en silencio. |
| `RENDER_API_MEDIA_ROOT` | `media` (contra `process.cwd()`) | Raíz a la que se confina todo el I/O del store. |
| `RENDER_API_DB_PATH` | `<mediaRoot>/.studio/studio.db` | SQLite de `@video-maker/local-store`: proyectos, organización, conversación/sesión del productor, jobs, configuración. |
| `RENDER_API_MAX_UPLOAD_BYTES` | `2147483648` | Enforced dos veces: por `content-length` y mientras el body streamea. |
| `RENDER_API_OBJECT_STORE` | `fs` | Sólo `fs` (D-11, MinIO descopado). Cualquier otro valor ⇒ exit 78. |
| `RENDER_API_URL` | `http://<host>:<port>` | La URL que se le dice al productor para encolar jobs en este mismo servicio. Gana `/api` cuando `RENDER_API_WEB_ROOT` está seteada. |
| `RENDER_API_WEB_ROOT` | — | Sin setear: sólo API. Seteada: sirve la web estática y mueve la API a `/api` (`GET /health` queda afuera del prefijo). |
| `RENDER_API_ACCESS_TOKEN` | — | Sin setear: sin guardia de acceso (dev local). Seteada: toda ruta exige la cookie `vm_session` o el header `x-studio-token` más un `Host` local. |
| `VIDEO_MAKER_PARENT_PID` | — | Watchdog: si el PID del padre (Electron) deja de existir, el watchdog mata el árbol de procesos propio, incluido Chrome huérfano de Remotion. |
| `FFMPEG_PATH` / `FFPROBE_PATH` / `WHISPER_CPP_PATH` | — | Sin la variable, se resuelven por `PATH`. |
| `WHISPER_MODEL_PATH` / `TTS_VOICES_DIR` | — | Son **modelos/directorios de voces, no ejecutables**: nunca se resuelven por `PATH` y sin ellos `/health` reporta `degraded`. |
| `TTS_CLI_PATH` | — | CLI de síntesis de voz sherpa-onnx, instalado fuera del repo. Reemplazó a Piper (`PIPER_PATH`/`PIPER_MODEL_PATH`). |
| `CLAUDE_CLI_PATH` | `claude` | Claude Code CLI, compartido por el agente de storyboard y por el productor cuando su motor efectivo es Claude. Sin API key. |
| `CLAUDE_CLI_CWD` | temporal del SO | Working directory del agente de **storyboard**: fuera del repo, para que no cargue el `CLAUDE.md` del proyecto. |
| `CLAUDE_CLI_TIMEOUT_MS` / `CLAUDE_CLI_MODEL` | `600000` / `sonnet` | Sólo del job `storyboard`. El agente **nunca** se invoca sin `--model`: el `model?` del request gana sobre este default. |
| `STUDIO_MCP_ENTRY` | — | Ruta al entrypoint compilado del servidor MCP `studio` (empaquetado); sin setear, el productor lo arranca desde fuente en dev. |
| Key de OpenRouter | — | No es una env var: vive en el llavero de macOS (servicio "Video Maker", cuenta "openrouter"), gestionada por `EP-037`..`EP-040`. |
| `PRODUCER_MODEL` | `sonnet` | Modelo **default** del productor cuando el motor es Claude; debe pertenecer a `PRODUCER_MODELS` o el arranque aborta con `SERVER_CONFIG_INVALID`. |
| `PRODUCER_MODELS` | `sonnet,opus,haiku` | Lista permitida para el motor Claude. Valida el `model?` de los turnos y de los jobs `storyboard`/`voice`, y es la que `EP-022` publica como `models.allowed`. |
| `PRODUCER_TURN_TIMEOUT_MS` | `1800000` | Media hora: un turno puede incluir transcripción y render. Inválido ⇒ exit 78. |
| `REMOTION_SERVE_URL` / `REMOTION_BROWSER_EXECUTABLE` | — | Empaquetado: el bundle de Remotion precompilado se copia una vez a `<dir de la base>/remotion-bundle/<hash>/` y cada render re-apunta `public` al proyecto. |
| `VOICE_PREVIEW_CACHE_DIR` | `<tmp del SO>/video-maker-voice-previews` | Caché del preview de voces (`EP-026`), deliberadamente fuera de `mediaRoot`: nunca se poda, el SO lo limpia. |

**El puerto default `4310` puede estar tomado** por el visor de docs del kit SDD (`pnpm sdd:docs`).
Un `EADDRINUSE` ahí no es un defecto del servicio: los smokes usan `4399`.

## Trampas conocidas (medidas, no teóricas)

- **`nx run render-api:serve` NO propaga el exit code real** (Nx normaliza todo fallo a `1`). Para
  observar un exit code exacto hay que invocar el binario directo con
  `SWC_NODE_PROJECT=tsconfig.base.json node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts`.
- **El exit code después de un render no es parte del contrato:** `SIGTERM` responde `0` en un
  proceso que no rindió nada y **143** en uno que sí, porque `@remotion/renderer` instala sus
  propios handlers de señal. Un `process.exit(0)` explícito se probó y **no** lo corrige.
- **Un hijo del productor sobrevive al proceso del servicio** si nadie lo mata: `close()` cancela
  todos los turnos vivos justamente por eso (un huérfano siguió escribiendo en el proyecto de un
  smoke y contaminó la medición siguiente). Empaquetado, el watchdog de `VIDEO_MAKER_PARENT_PID`
  cubre el caso donde el propio proceso de `render-api` queda huérfano de Electron.
- **`AI_AGENT_FAILED` publica el detalle del proveedor** (`subtype` y `result`, recortados a 600
  caracteres) y un `hint` que nombra `claude update` ante `claude_code_version_too_old`. Ese `result`
  **puede contener rutas absolutas de la máquina**: canje deliberado para un studio self-hosted,
  documentado en el README de la app. El marcador de cuota sigue teniendo prioridad y mapea a
  `AI_AGENT_RATE_LIMITED`; OpenRouter tiene su propio marcador de cuota agotada.
- **La API no expone `pruneSilences`** (sí la CLI, con `--prune-silences`): en `voice: 'script'` la
  poda queda apagada y no hay forma de forzarla por HTTP.
- **`VoiceJobReport` cambió de forma** con el modo guion: ganó `source` y `track`, y `storyboardId`
  pasó a `string | null`. Todo consumidor nuevo tiene que narrar los dos modos.
- **El store no es seguro entre procesos.** La serialización por slug (`createKeyedSerializer`) es
  intra-proceso: correr `tools/render-cli` contra un proyecto mientras la API escribe su catálogo es
  una carrera y gana el que escribe último. La cola tiene el mismo riesgo: concurrencia 1 vale
  **dentro de un** proceso, aunque el estado ya persista en SQLite.
- **Los binarios reales sólo se ejercitan en el smoke manual**, nunca en CI. Antes de correrlo:
  `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` vacío (más el binario de voz configurado) y
  ≥ 35 % de memoria libre (el `[Cc]hrome` del guion original matchea el navegador del dev y aborta el
  smoke con un falso positivo).
- **El delete de assets (`EP-027`) no tiene índice inverso**: borrar deja huérfanos en
  `work/renders/<jobId>/`, `work/edl.json` y `out/`, y un `?force=true` deja la timeline apuntando a
  un archivo que ya no está — el `200` lo informa en `timelineReferences`, pero nadie repara la
  timeline sola. El `hint` del `409` lista **todos** los usos: una timeline con muchos clips del
  mismo A-roll da una línea larga.
- **El preview de voz (`EP-026`) no se regenera al cambiar la frase**: la invalidación mira el
  `mtime` del modelo de voz, no el código del servicio. Bumpear `VOICE_PREVIEW_REVISION` es la única
  forma de que un dev con caché caliente deje de escuchar la frase vieja. La frase es fija y en
  español: una voz `en_US` la lee con fonética inglesa.
- **Los 404 especulativos de `script.txt`/`script-manifest.json`** en storyboard y voz siguen
  apareciendo en la consola cuando el productor sondea si existen antes de crearlos.
