# Context Prompt — apps/render-api

> Entry point para agentes que trabajen sobre `apps/render-api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-016 cycle-01 | Fecha: 2026-09-11
> Consolidado al cerrar `cycle-01` de `spec-e-burgos-016-studio-usability` (fundió los fragmentos de
> `FIX-003-003`, `FIX-005-001`, `FIX-006-001`, `FIX-009-002`, `FIX-015-004` y el propio `cycle-01`).

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario)
- **Estado:** **completo.** 28 rutas, 86 códigos de error, 80 archivos de test / 981 tests. Verificado contra binarios
  reales (Remotion, FFmpeg, whisper-cli, Piper y `claude -p`) en smokes manuales, nunca en CI.
- **Specs que la gobiernan:** `spec-003-kinetic-captions` (`FIX-003-003` le sumó `captionStyle` al
  job `montage`) · `spec-005-render-service` (la creó; `FIX-005-001` le sumó el borrado de assets,
  `EP-027`) · `spec-006-web-studio` (`FIX-006-001` le sumó `EP-028`, listado de generados para la
  biblioteca) · `spec-007-web-montage` (job `montage`) · `spec-008-ai-storyboard` (job `storyboard`
  y el puerto `aiAgent`) · `spec-009-voice-over` (job `voice` y Piper; `FIX-009-001` le sumó el modo
  guion suelto y `FIX-009-002` las marcas de tiempo del guion) · `spec-014-production-quality`
  (guion y logo en el job `montage`) · `spec-015-studio-producer` (`cycle-01` cerrado: el productor
  conversacional; `cycle-02` es la pantalla en `apps/web`; `FIX-015-001` le dio modelo por request,
  `FIX-015-002` la lista blanca por turno y `FIX-015-004` las reglas de entrega y de logo del system
  prompt) · `spec-016-studio-usability` (`cycle-01` cerrado: catálogo de voces enriquecido, `EP-019`,
  y preview de voz, `EP-026`).
- **Rol en el sistema:** la puerta HTTP del motor. Es **el único subproyecto del monorepo que puede
  depender a la vez de `libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`)**:
  los `depConstraints` del `eslint.config.mjs` raíz impiden que esas dos libs se importen entre sí, y
  el tag `type:app` cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`. Por eso
  la orquestación `render → mix → mux → verify` en una sola llamada vive acá. (`tools/render-cli`,
  con tags `scope:engine`/`type:tool`, cae en el mismo fallback y desde `spec-015` hace los mismos
  cuatro pasos.)
- **Depende de:** `@video-maker/timeline-core`, `@video-maker/auto-montage`,
  `@video-maker/media-local` y `@video-maker/composition-remotion/render` (subpath `/render`
  exclusivamente, vía `await import()`). **Cero dependencias npm propias.**
- **No contiene lógica de motor propia:** si un cálculo hace falta, va a una lib. Acá vive sólo el
  transporte HTTP, la orquestación de llamadas y la traducción de errores a payload de máquina.
- **Consumidor:** `apps/web` (Web Studio), que consume HTTP y **no** exit codes, y el dev en su
  máquina.

## Mapa del código

```
src/
  main.ts                      única frontera de proceso (env, señales, exitCode, stdout/stderr)
  server-register.cjs          loader @swc-node/register acotado a .ts
  config/                      server-config · store-config · ai-agent-config · producer-config ·
                               voice-preview-config
  deps/                        contrato de puertos + puerto ObjectStorage + adaptador de producción
  ai/                          claude-cli-ai-agent (request/response con --json-schema, storyboard)
  engine/                      nombres de módulos de motor y de binarios de media
  errors/                      86 códigos, etapas por tipo de job, PipelineStageError y traducciones
  pipeline/                    runRenderPipeline (prepare → render → mix → mux → verify) + observer
  jobs/                        unión discriminada por kind (render|montage|storyboard|voice),
                               máquina de estados pura, progreso monotónico, cola FIFO
  storyboard/                  documento, inventario, prompt y export numerado de prompts
  voice/                       rutas, formatos, idioma, selección de escenas, store del manifest,
                               catálogo/preview de voces (voice-preview, voice-preview-url)
  producer/                    conversación persistida, prompt del sistema, mapeo del stream-json,
                               puerto ProducerAgent + adaptador Claude Code, registro de turnos
  store/                       slug · asset-path · layout · catalog-merge · project-assets ·
                               project-scope · montage-preconditions · serialize-by-key ·
                               timeline-asset-references
  http/                        router con params y comodín, handlers (incl. generated, voice-preview),
                               query-flag, health, runtime, servidor
  __fixtures__/                call-log ordenado y dobles de todos los puertos
```

## Contrato y comportamiento que hay que respetar

- **28 endpoints, registrados campo a campo en `sdd/api.json`** (`EP-001`..`EP-028`). Es el contrato
  que `apps/web` consume: ningún campo publicado cambia de nombre, tipo ni semántica sin un ciclo
  que lo declare. Toda aserción de forma se hace con `Object.keys(body).sort()` contra la interfaz,
  nunca campo por campo contra lo que el handler ya emite.
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
  `description` y `previewUrl`, derivado del `.onnx.json` de cada modelo (o del nombre del archivo si
  el sidecar falta). **`GET /voices/:voiceId/preview` (`EP-026`)** sintetiza con Piper una frase fija
  en español (~4 s), la cachea (`voicePreviewCache`, fuera de `mediaRoot`) y la sirve como
  `audio/wav` con `Cache-Control: public, max-age=86400`; `404 VOICE_NOT_FOUND` / `503
  VOICE_MODEL_UNAVAILABLE`.
- **`GET /health`** reporta módulos de motor, los **seis** binarios de media (por nombre lógico y
  variable de entorno, **nunca** por ruta resuelta), `capabilities` y `jobs: { running, queued }`.
  El bloque `jobs` es un contador de carga: **nunca** afecta el cálculo `ok`/`degraded`.
  `capabilities.producer` sale de una sonda del binario de Claude Code y **tampoco** entra en ese
  cálculo: `claude` no está en `binaries` porque volvería `degraded` toda máquina sin Claude Code,
  CI incluido (D-12 de `spec-008`). Piper sí está, y una máquina sin Piper reporta `degraded`.
- **Cola de jobs:** FIFO, **concurrencia 1**, en memoria, para los cuatro `kind`. Seis estados
  (`queued`/`running`/`canceling`/`succeeded`/`failed`/`canceled`). Cancelación **cooperativa**: no
  se señala ni se mata ningún proceso. Un job fallado es `200` con el error tipado **en el body**,
  no un status HTTP de error.
- **El productor corre FUERA de la cola** (`EP-022`..`EP-025`): un turno activo por proyecto
  (`409 PRODUCER_TURN_ACTIVE`), eventos `text`/`tool`/`status` derivados del `stream-json` de
  Claude Code a granularidad de mensaje, sugerencias de 2 a 4 acciones extraídas del bloque
  ```suggestions, y `DELETE` que **mata** el hijo (`202`, el turno queda `canceled` cuando el
  proceso muere de verdad). El registro es in-memory; la conversación vive en `work/producer/`.
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
| `RENDER_API_MAX_UPLOAD_BYTES` | `2147483648` | Enforced dos veces: por `content-length` y mientras el body streamea. |
| `RENDER_API_OBJECT_STORE` | `fs` | Sólo `fs` (D-11, MinIO descopado). Cualquier otro valor ⇒ exit 78. |
| `RENDER_API_URL` | `http://<host>:<port>` | La URL que se le dice al productor para encolar jobs en este mismo servicio. |
| `FFMPEG_PATH` / `FFPROBE_PATH` / `WHISPER_CPP_PATH` | — | Sin la variable, se resuelven por `PATH`. |
| `WHISPER_MODEL_PATH` / `PIPER_MODEL_PATH` | — | Son **modelos, no ejecutables**: nunca se resuelven por `PATH` y sin ellos `/health` reporta `degraded`. |
| `PIPER_PATH` | `piper` | Binario de Piper TTS, instalado fuera del repo. |
| `CLAUDE_CLI_PATH` | `claude` | Claude Code CLI, compartido por el agente de storyboard y por el productor. Sin API key. |
| `CLAUDE_CLI_CWD` | temporal del SO | Working directory del agente de **storyboard**: fuera del repo, para que no cargue el `CLAUDE.md` del proyecto. El productor no lo usa (necesita la raíz del repo). |
| `CLAUDE_CLI_TIMEOUT_MS` / `CLAUDE_CLI_MODEL` | `600000` / `sonnet` | Sólo del job `storyboard`. El agente **nunca** se invoca sin `--model`: el `model?` del request gana sobre este default. |
| `PRODUCER_MODEL` | `sonnet` | Modelo **default** del productor; debe pertenecer a `PRODUCER_MODELS` o el arranque aborta con `SERVER_CONFIG_INVALID`. |
| `PRODUCER_MODELS` | `sonnet,opus,haiku` | Lista permitida. Es la que valida el `model?` de los turnos y de los jobs `storyboard`/`voice`, y la que `EP-022` publica como `models.allowed`. |
| `PRODUCER_TURN_TIMEOUT_MS` | `1800000` | Media hora: un turno puede incluir transcripción y render. Inválido ⇒ exit 78. |
| `PRODUCER_SKILL_PATH` | `sdd/skills/video-producer/SKILL.md` | La skill **es** el system prompt del productor y se lee de disco en cada turno. |
| `PIPER_PREVIEW_CACHE_DIR` | `<tmp del SO>/video-maker-voice-previews` | Caché del preview de voces (`EP-026`), deliberadamente fuera de `mediaRoot`: nunca se poda, el SO lo limpia. |

**El puerto default `4310` puede estar tomado** por el visor de docs del kit SDD (`pnpm sdd:docs`).
Un `EADDRINUSE` ahí no es un defecto del servicio: los smokes usan `4399`.

## Trampas conocidas (medidas, no teóricas)

- **`nx run render-api:serve` NO propaga el exit code real** (Nx normaliza todo fallo a `1`). Para
  observar un exit code exacto hay que invocar el binario directo con
  `SWC_NODE_PROJECT=tsconfig.base.json node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts`.
- **El exit code después de un render no es parte del contrato:** `SIGTERM` responde `0` en un
  proceso que no rindió nada y **143** en uno que sí, porque `@remotion/renderer` instala sus
  propios handlers de señal. Un `process.exit(0)` explícito se probó y **no** lo corrige.
- **`--allowedTools` del CLI de Claude tiene dos límites medidos** (2.1.123), que definen cómo se
  confina al productor: un **patrón de ruta no confina una escritura** (`Write(dir/**)` denegó una
  escritura con path absoluto adentro de `dir/`), y un **comodín no autoriza un comando de shell del
  sistema que muta archivos** (`Bash(ls *)` alcanza; `Bash(mkdir *)`, `Bash(cp *)`, `mv` y `rm` se
  deniegan). Por eso la lista lleva `Write` pelado y no lleva `mkdir` ni `cp`. Un **binario propio**
  sí se autoriza con comodín: `Bash(<PIPER_PATH> *)` produjo un wav de 109 612 bytes. Todo binario
  nuevo se sondea con el comando real antes de escribirlo en la lista. Además `--allowedTools` es **variádico**:
  va último y con un patrón por argumento.
- **El hook `rtk` del repo reescribe el comando antes de que la lista blanca lo mire**: el hijo del
  productor corre con cwd en la raíz del repo, así que `curl …` llega como `rtk curl …`, `cat X`
  como `rtk read X` y `ls` como `rtk ls`. De ahí los tres patrones `Bash(rtk …)` de la lista.
- **Un hijo del productor sobrevive al proceso del servicio** si nadie lo mata: `close()` cancela
  todos los turnos vivos justamente por eso (un huérfano siguió escribiendo en el proyecto de un
  smoke y contaminó la medición siguiente).
- **`AI_AGENT_FAILED` publica el detalle del proveedor** (`subtype` y `result`, recortados a 600
  caracteres) y un `hint` que nombra `claude update` ante `claude_code_version_too_old`. Ese `result`
  **puede contener rutas absolutas de la máquina**: canje deliberado para un studio self-hosted,
  documentado en el README de la app. El marcador de cuota sigue teniendo prioridad y mapea a
  `AI_AGENT_RATE_LIMITED`.
- **La API no expone `pruneSilences`** (sí la CLI, con `--prune-silences`): en `voice: 'script'` la
  poda queda apagada y no hay forma de forzarla por HTTP.
- **`VoiceJobReport` cambió de forma** con el modo guion: ganó `source` y `track`, y `storyboardId`
  pasó a `string | null`. Todo consumidor nuevo tiene que narrar los dos modos.
- **El store no es seguro entre procesos.** La serialización por slug (`createKeyedSerializer`) es
  intra-proceso: correr `tools/render-cli` contra un proyecto mientras la API escribe su catálogo es
  una carrera y gana el que escribe último. La cola tiene el mismo riesgo: concurrencia 1 vale
  **dentro de un** proceso.
- **La cola y el registro de turnos no persisten** entre reinicios y no tienen cap de historial. Un
  job o un turno perdido cae en el mismo `404` que un id inexistente.
- **Los binarios reales sólo se ejercitan en el smoke manual**, nunca en CI. Antes de correrlo:
  `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|piper'` vacío y ≥ 35 % de memoria libre (el
  `[Cc]hrome` del guion original matchea el navegador del dev y aborta el smoke con un falso
  positivo).
- **El delete de assets (`EP-027`) no tiene índice inverso**: borrar deja huérfanos en
  `work/renders/<jobId>/`, `work/edl.json` y `out/`, y un `?force=true` deja la timeline apuntando a
  un archivo que ya no está — el `200` lo informa en `timelineReferences`, pero nadie repara la
  timeline sola. El `hint` del `409` lista **todos** los usos: una timeline con muchos clips del
  mismo A-roll da una línea larga.
- **El preview de voz (`EP-026`) no se regenera al cambiar la frase**: la invalidación mira el
  `mtime` del modelo Piper, no el código del servicio. Bumpear `VOICE_PREVIEW_REVISION` es la única
  forma de que un dev con caché caliente deje de escuchar la frase vieja. La frase es fija y en
  español: una voz `en_US` la lee con fonética inglesa.
