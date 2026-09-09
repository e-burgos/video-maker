# SPEC-e-burgos-007: Web Montage: Ingest & Auto-Montage from the Studio

> Estado: **in-progress** — redactada por el orquestador al registrar la spec (2026-09-09);
> `cycle-01` abierto el mismo dia con flow `full` (pedido `[FULL]`: crea un contrato HTTP que
> `apps/web` consume en `cycle-02`).
> `cycle-01` detalla y ejecuta la parte de API; `cycle-02` amplía las secciones de `apps/web`.

## Resumen Ejecutivo

Hoy el Web Studio (`spec-e-burgos-006`) puede crear un proyecto, subir material crudo, previsualizar
una `Timeline` persistida, editarla y renderizarla — pero **no puede producir esa `Timeline`**. Las
dos etapas que la generan (`ingest`, que transcribe con Whisper y arma `work/catalog.json`, y `plan`,
que corre el auto-montaje y escribe `work/timeline.json` + `work/edl.json`) sólo existen en
`tools/render-cli`. Un proyecto creado desde la web queda sin timeline, y sin timeline no hay
preview, ni edición, ni render: el `POST /projects/:slug/jobs` responde `404 TIMELINE_NOT_FOUND`.

Esta spec cierra ese hueco para que **el flujo completo sea por la web**: subir material → generar
el montaje → ajustarlo → renderizar → descargar. No agrega motor: mueve el disparo de un motor que
ya existe y está cerrado (`libs/auto-montage`) desde la CLI hacia la API, y desde la API hacia la UI.

**Invariante que gobierna la spec:** la salida del montaje generado por la API tiene que ser
**byte-idéntica** a la que produce `tools/render-cli` para el mismo input. La API no reimplementa la
secuencia: llama a la misma API pública de la lib, en el mismo orden.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev que origina la spec: *"La idea es usar web-studio para todo, por algo
generamos una web."* El producto es local y mono-usuario; la CLI sigue existiendo y sigue siendo
válida, pero deja de ser **obligatoria** para llegar a un MP4.

**Alcance previsto:** un segundo tipo de job en la cola de `apps/render-api` que ejecuta
`ingest` + `plan` sobre `media/<slug>/`, con progreso por etapa y errores tipados
(`cycle-01`), y el disparo de ese job desde la biblioteca de assets del studio, con progreso,
confirmación de sobreescritura y estado vacío accionable en la página de preview (`cycle-02`).

## Evidencia y decisiones

> Citar, no copiar: las entradas referencian el documento origen, no lo reproducen.

- **Evidencia (`apps/render-api/src/http/routes.ts`, las 15 rutas, medida al registrar la spec):**
  ninguna ruta ejecuta `ingest` ni `plan`. `handleCreateRenderJob`
  (`src/http/handlers/jobs-handler.ts`) llama a `readStoredTimeline`, que lanza
  `TIMELINE_NOT_FOUND` si `work/timeline.json` no existe. La API **consume** el timeline; nunca lo
  produce. Es la evidencia del hueco que esta spec cierra.
- **Evidencia (`sdd/api.json` → `EP-012`):** *"Takes no request body: a payload, if sent, is never
  read or parsed."* Introducir un discriminante `kind` en el body es por construcción
  retro-compatible: lo que `apps/web` manda hoy (nada) sigue significando `render`. Fundamenta D-2.
- **Evidencia (`tools/render-cli/src/commands/ingest-command.ts` y `plan-command.ts`):** los dos
  comandos no tienen lógica propia de motor. `ingest` = `assertProjectIsIngestable` →
  `resolveBinaries(env)` → `ingestProject(project, { binaries }, deps)`. `plan` =
  `assertCatalogExists` → `autoMontage(project, { preset, seed }, deps)`. Ambas funciones son API
  pública de `libs/auto-montage` (`libs/auto-montage/src/index.ts`). Reproducir la secuencia en la
  API es reproducir esas cuatro llamadas, no reescribir nada. Fundamenta D-4.
- **Evidencia (`libs/media-local/src/binaries/resolve-binaries.ts`):** `resolveBinaries(env)`
  resuelve **cuatro** nombres — `ffmpeg`/`FFMPEG_PATH`, `ffprobe`/`FFPROBE_PATH`,
  `whisperCli`/`WHISPER_CPP_PATH` y `whisperModel`/`WHISPER_MODEL_PATH` — y `whisperModel`
  **no tiene fallback por `PATH`**: sin la variable lanza `BinaryNotFoundError`.
- **Evidencia (`apps/render-api/src/engine/media-binaries.ts` y `src/deps/node-render-api-dependencies.ts`):**
  el servicio hoy conoce y resuelve **dos** binarios (`MEDIA_BINARY_NAMES = ['ffmpeg','ffprobe']`,
  `loadBinaries()`). Whisper no está en su superficie: ni en `GET /health`, ni en el adaptador.
  Fundamenta D-7.
- **Evidencia (`libs/auto-montage/src/ingest/ingest-project.ts` y `src/auto-montage.ts`):** ninguna
  de las dos funciones acepta un observador de progreso; `ingestProject` hace *discover → probe →
  transcribe* dentro de una sola llamada, y `probeAssets`/`transcribeAssets` **no** están exportadas
  en el barrel. Reportar cuatro etapas sin tocar la lib obliga a observar lo único inyectable que
  distingue una etapa de otra: el `CommandRunner`. Fundamenta D-5.
- **Evidencia (`apps/render-api/README.md` § "Known limits (cycle-03)"):** la cola despacha **un**
  job a la vez, FIFO, intra-proceso. Un segundo `kind` en **la misma** cola hereda esa garantía sin
  código nuevo, y es exactamente la regla de operación vigente del repo (`sdd/memory/lessons.md`:
  *"nunca correr render y transcripción a la vez"*). Fundamenta D-2.
- **Evidencia (`apps/render-api/src/http/render-api-runtime.ts`):** `RenderApiRuntime` es el estado
  vivo por servidor (`jobs`, `uploadSerializer`) y `RenderApiDependencies` es el contrato de puertos
  **sin estado**. Todo puerto nuevo que el montaje necesite entra por `RenderApiDependencies`; nada
  de estado de módulo (deuda ya pagada en `spec-005` `cycle-03`, D-23).
- **Evidencia (`apps/render-api/README.md` § "Known risk: the store is not safe across processes"):**
  la serialización por slug es intra-proceso. Correr `tools/render-cli ingest` contra un proyecto
  mientras la API escribe su catálogo sigue siendo una carrera; esta spec **no** la resuelve y no la
  empeora: el job de montaje escribe por el mismo camino que ya escribe el upload.
- **Evidencia (`sdd/context/apps/render-api/updates/…cycle-03.md` § Qué sigue):** el exit code
  después de un render es `143` y **no es contrato**. Vale igual para esta spec: ningún criterio de
  aceptación se apoya en el exit code del servicio.
- **Decisión heredada de `spec-005` (D-30):** `MixTimelineAudioInput` lleva `projectRoot` y el
  adaptador invoca con `runOptions: { cwd: projectRoot }`, porque los `Timeline.assets[].path` son
  relativos. Todo puerto nuevo de esta spec que pase paths relativos a un binario tiene que llevar
  la raíz junto al documento (lección vigente de `sdd/memory/lessons.md`).
- **Decisión heredada de `spec-005`:** D-2 cero dependencias npm salvo justificación · D-4 payload de
  máquina en inglés · D-8 intermedios conservados · D-9 `apps/render-api/eslint.config.mjs` descopado
  por el hook `config-protection` · D-11 MinIO descopado (`RENDER_API_OBJECT_STORE` sólo `fs`).
- **Decisión del dev (perfil `solo`):** las decisiones de producto de esta spec las toma el actor del
  ciclo con recomendación fundada y quedan escritas. `cycle-01` se pidió explícitamente `[FULL]`
  porque crea un contrato HTTP que `apps/web` consume en `cycle-02`.

## Decisiones del orquestador

| ID | Decisión | Fundamento |
| --- | --- | --- |
| **D-1** | La spec se ejecuta en **dos ciclos**: `cycle-01` `full` (API) y `cycle-02` `lite` (UI). | El riesgo está concentrado en un solo lado: el contrato HTTP y la byte-identidad del montaje. Una vez que la API produce el timeline, la UI es un botón, un poller y un estado vacío — no justifica cuatro documentos. `cycle-01` es `full` porque crea el contrato que el otro subproyecto consume (regla de flow de `sdd-gates.md`). |
| **D-2** | **Un solo endpoint de jobs con discriminante `kind: 'render' \| 'montage'`** (`EP-012` pasa a `updated`), con `render` por default cuando no hay body. No se crea un endpoint nuevo de montaje. | Tres razones, en orden de peso: (1) retro-compatibilidad literal — `EP-012` documenta que hoy el body *nunca* se lee, así que los 307 tests de `apps/web` y su cliente HTTP siguen verdes sin tocarlos; (2) **una sola cola** es lo que garantiza que jamás corran transcripción y render a la vez (concurrencia 1, ya implementada y ya verificada), invariante de operación de esta máquina; (3) `GET /jobs/:jobId` ya es global por id y no por proyecto, así que un segundo `kind` no parte el modelo de lectura. Un endpoint nuevo obligaría a una segunda cola o a un dispatcher cruzado entre dos colas para conservar (2). |
| **D-3** | **Cero dependencias npm nuevas** en toda la spec. | Hereda D-2 de `spec-005`: el motor ya está en el workspace (`@video-maker/auto-montage`, `@video-maker/media-local`), y el transporte es `node:http`. Seis specs con la regla; ningún consumidor real la justifica acá. |
| **D-4** | **La API no reimplementa `ingest` ni `plan`**: llama a `ingestProject` y `autoMontage` de `libs/auto-montage`, en el mismo orden y con las mismas precondiciones que `tools/render-cli`. La byte-identidad se verifica con **`sha256`** de `work/catalog.json`, `work/timeline.json` y `work/edl.json` contra los de la CLI sobre el mismo input. | Es la única forma barata de garantizar el invariante de la spec: mismo código, mismos bytes. Una segunda implementación "equivalente" divergiría en el primer cambio de la lib y ninguna suite lo vería. Además, el oráculo `sha256` **tiene que probarse sensible** (corriendo a propósito el cambio que debería romperlo): lección vigente del repo, pagada en `spec-002`. |
| **D-5** | **Las cuatro etapas (`discover`/`probe`/`transcribe`/`plan`) se observan decorando el `CommandRunner` inyectado**, no modificando `libs/auto-montage`. El decorador clasifica cada invocación por la ruta de binario **ya resuelta** (`binaries.ffprobe` → `probe`, `binaries.ffmpeg`/`binaries.whisperCli` → `transcribe`), y el job fija `discover` antes de llamar a `ingestProject` y `plan` antes de llamar a `autoMontage`. | `ingestProject` no acepta observador y no exporta sus sub-pasos (evidencia arriba). Las dos alternativas son peores: sumar un observador a la lib mete un subproyecto ajeno y una spec cerrada en el ciclo, y descomponer la secuencia dentro de la API rompe D-4. El decorador es puro pass-through: **no puede** alterar un byte de la salida, y da de yapa un contador por asset para el porcentaje. Restricción que asume: las etapas son monotónicas y **salteables** (un proyecto con todo reusado del catálogo previo no emite `probe`), y eso es contrato explícito, no defecto. |
| **D-6** | **Un timeline existente nunca se pisa por accidente**: sin `overwrite: true` el job de montaje se rechaza con un código propio y HTTP **409**; con `overwrite: true` se ejecuta y reescribe. | El timeline es lo único del proyecto que el dev edita a mano desde la web (`spec-006` `cycle-03`): regenerarlo descarta ese trabajo. Un 409 explícito es lo que le permite a la UI de `cycle-02` pedir confirmación con fundamento en vez de adivinar. `409` y no `422` porque el pedido es válido: es el **estado del recurso** el que lo bloquea. |
| **D-7** | **`whisper-cli` y el modelo de Whisper entran a la superficie del servicio**: se suman a `MEDIA_BINARY_NAMES` y por lo tanto a `binaries[]` de `GET /health` (`EP-001` pasa a `updated`), y el adaptador resuelve los cuatro binarios. Consecuencia aceptada: en una máquina sin `WHISPER_MODEL_PATH`, `GET /health` responde `degraded`. | El servicio pasa a depender de Whisper de verdad; un health que no lo reporta miente exactamente en el caso que importa (el montaje va a fallar y el dev no tiene por qué descubrirlo con un job fallado de tres minutos). `degraded` es la señal honesta y `apps/web` ya la sabe mostrar. `resolveBinaries` no tiene fallback por `PATH` para el modelo, así que la variable es obligatoria y el health es el lugar donde eso se ve. |
| **D-8** | **`GET /health` suma `capabilities.montageQueue` y NO toca el campo `cycle`.** | `capabilities` es un mapa aditivo, hecho para esto. `cycle` es el contador de ciclos de `spec-005` sobre este subproyecto: pisarlo desde otra spec lo vuelve un número sin dueño. La app no lo usa para decidir nada. |
| **D-9** | **Errores tipados propios, en inglés, con mapeo HTTP explícito** (familia `MONTAGE_*` sobre `RENDER_API_ERROR_CODES`), y ninguno filtra rutas absolutas del host ni `.stack`. | D-4 de `spec-005`, vigente. Un `code` nuevo es contrato: `cycle-02` lo muestra tal cual, sin tabla de traducción (D-7 de `spec-006`). Y un error tipado sólo se da por implementado si **puede** dispararse: lección vigente del repo contra los guards sobre condiciones imposibles. |
| **D-10** | **El smoke real es criterio de aceptación del `cycle-01`, no un procedimiento documentado**, y su guion copiable vive en `apps/render-api/README.md` (nunca sólo en el `architect.md`). | Lección vigente y pagada dos veces en este repo: *"un CA aceptado como procedimiento documentado, nunca ejecutado, no está verificado"*, y *"el guion copiable es el del README"* (el del `architect.md` de `spec-005` no arranca copiado tal cual). |
| **D-11** | **`apps/render-api/eslint.config.mjs` sigue sin crearse.** | D-9 de `spec-005`: el hook `config-protection` del harness del dev bloquea `Write\|Edit` sobre ese basename y rodearlo con `Bash` anularía el guardrail. El proyecto lintea contra el flat config raíz. |
| **D-12** | **El job de montaje hereda las limitaciones conocidas de la cola** sin intentar arreglarlas: en memoria, sin persistencia entre reinicios, sin cap de historial, concurrencia 1 intra-proceso. | Ninguna es observable como contrato nuevo (un job perdido cae en el mismo `404 RENDER_JOB_NOT_FOUND` que un id inexistente). Arreglarlas es el mismo cambio —worker en proceso aparte— que `spec-005` descopó con fundamento; meterlo acá duplicaría el alcance del ciclo. |

## Plan de ciclos

| Ciclo | Fase | Flow | Qué entrega | Estado |
| --- | --- | --- | --- | --- |
| **cycle-01** | `montage-job-api` | `full` | En `apps/render-api`, un segundo tipo de job en la misma cola (`kind: 'montage'`) que ejecuta sobre `media/<slug>/` el equivalente exacto de `render-cli ingest` + `plan` usando la API pública de `libs/auto-montage`, con `preset` (default `software-demo`) y `seed` (default `0`), progreso por etapa `discover\|probe\|transcribe\|plan`, `overwrite` explícito (409 sin él), errores tipados y mapeo HTTP, los cuatro binarios resueltos desde el `.env` raíz, y `sha256` de `catalog.json`/`timeline.json`/`edl.json` idéntico al de la CLI. Contrato registrado en `sdd/api.json`. Smoke real: job `montage` sobre una copia de `media/smoke-ingest` sin `work/`, y un job `render` encadenado que termina en MP4 verificado con `ffprobe`. | **in-progress** |
| **cycle-02** | `montage-from-the-studio` | `lite` | En `apps/web`, botón "Generate montage" en la biblioteca de assets con selector de preset y seed, progreso del job por etapa (la transcripción es la etapa lenta), salto al preview al terminar, confirmación explícita antes de regenerar sobre un proyecto ya editado (D-6), y estado vacío accionable en la página de preview cuando el servicio responde `TIMELINE_NOT_FOUND`. E2E con Playwright desde `raw/` hasta el MP4. Cierra la spec. | **pending** |

## Requisitos Funcionales (RF)

### Ciclo 01 — `montage-job-api`

- **RF-1:** La cola de `apps/render-api` acepta **dos** tipos de job. `POST /projects/:slug/jobs`
  con body ausente, vacío o sin `kind` crea un job de render con el comportamiento actual, byte por
  byte de payload; con `kind: "montage"` crea un job de montaje.
- **RF-2:** El job de montaje ejecuta, sobre `media/<slug>/`, la misma secuencia que
  `render-cli ingest` seguido de `render-cli plan`: precondiciones de proyecto ingestable →
  resolución de los cuatro binarios → `ingestProject` → precondición de catálogo →
  `autoMontage`. No hay lógica de montaje propia en la app (D-4).
- **RF-3:** Los parámetros del job de montaje son `preset` (uno de los presets de
  `libs/auto-montage`, default `software-demo`), `seed` (entero no negativo, default `0`) y
  `overwrite` (booleano, default `false`). Un valor inválido se rechaza antes de registrar el job.
- **RF-4:** El job de montaje escribe `work/catalog.json`, `work/timeline.json` y `work/edl.json`
  con **el mismo `sha256`** que produce `tools/render-cli` para el mismo input (RNF-1).
- **RF-5:** El progreso del job de montaje se reporta por el mismo mecanismo que el de render
  (`GET /jobs/:jobId` → `progress`), con sus propias etapas `discover`, `probe`, `transcribe`,
  `plan`, monotónicas y salteables, y con contadores de assets durante `probe` y `transcribe`
  cuando el total es conocido.
- **RF-6:** Si el proyecto ya tiene `work/timeline.json`, un job de montaje sin `overwrite: true`
  se rechaza con un código tipado propio y HTTP `409`, **sin registrar ningún job** y sin tocar el
  disco. Con `overwrite: true` el job corre y reescribe (D-6).
- **RF-7:** `GET /jobs/:jobId` y `GET /projects/:slug/jobs` devuelven el `kind` de cada job, y las
  etapas propias de cada tipo. Todos los campos que ya devolvían siguen presentes con el mismo
  nombre y la misma semántica.
- **RF-8:** La cancelación (`DELETE /jobs/:jobId`) funciona sobre un job de montaje con la misma
  semántica cooperativa que sobre uno de render: `queued` → `canceled` (200) inmediato;
  `running` → `canceling` (202) y liquidación en el próximo checkpoint de etapa, sin señalar ni
  matar ningún proceso.
- **RF-9:** Los errores del motor se traducen a códigos propios en inglés con mapeo HTTP explícito,
  y el payload nunca expone rutas absolutas del host, `.stack`, ni el `message` de la lib cuando
  ese mensaje lleva la ruta de un binario (D-9).
- **RF-10:** El adaptador de producción resuelve los **cuatro** binarios (`ffmpeg`, `ffprobe`,
  `whisper-cli`, modelo de Whisper) desde `process.env`, y `GET /health` reporta los cuatro por
  nombre lógico y variable de entorno, nunca por ruta resuelta (D-7).
- **RF-11:** `GET /health` reporta `capabilities.montageQueue: true` y no altera ningún otro campo
  ya existente (D-8).
- **RF-12:** El README de `apps/render-api` documenta el nuevo tipo de job, sus parámetros, sus
  etapas, sus códigos de error, cómo el binario recibe las variables del `.env` raíz, y el guion
  copiable del smoke real (D-10).
- **RF-13:** El contrato queda registrado en `sdd/api.json`: los endpoints tocados con
  `status: "updated"`, `updated_in_cycle` y su entrada de `changelog`; ningún endpoint nuevo si el
  arquitecto ratifica D-2.

## Requisitos No-Funcionales (RNF)

- **RNF-1:** **Byte-identidad verificada, no asumida.** El `sha256` de los tres artefactos de
  `work/` producidos por la API es idéntico al de los producidos por la CLI, y el oráculo se prueba
  sensible: un cambio deliberado de `preset` o `seed` tiene que romperlo.
- **RNF-2:** **100 % compatible hacia atrás con `apps/web`.** Los 307 tests de `apps/web` pasan sin
  modificarlos, y ningún campo ya publicado de `EP-001`, `EP-012`, `EP-013`, `EP-014` o `EP-015`
  cambia de nombre, tipo o semántica.
- **RNF-3:** Cero dependencias npm nuevas (D-3): `git diff --stat package.json pnpm-lock.yaml`
  vacío al cerrar el ciclo.
- **RNF-4:** `pnpm nx run-many -t lint test build` en verde y **sin warnings** para todo el
  workspace.
- **RNF-5:** Cobertura de `apps/render-api` por encima del piso declarado en su `vite.config.ts`,
  con el `coverage.include` **sin recortar** para alcanzarlo.
- **RNF-6:** La suite corre sin `ffmpeg`, `ffprobe`, `whisper-cli` ni Chrome: todo I/O nuevo entra
  por puertos inyectables de `RenderApiDependencies` y ningún estado de módulo nuevo aparece en el
  subproyecto.
- **RNF-7:** Sin comentarios en el código de implementación; identificadores, payloads, commits y
  README en inglés. Documentos SDD en español.
- **RNF-8:** El material del dev (`media/smoke-ingest`, `media/video-01`, `media/video-02`) no se
  modifica: toda verificación real corre sobre copias en un `RENDER_API_MEDIA_ROOT` temporal.

## Dependencias

- Subproyectos: `apps/render-api` (`cycle-01`), `apps/web` (`cycle-02`).
- Consume sin modificar: `libs/auto-montage`, `libs/media-local`, `libs/timeline-core`.
- `spec-e-burgos-002-auto-montage-pipeline` — completed (`ingestProject`, `autoMontage`, presets).
- `spec-e-burgos-005-render-service` — completed (cola de jobs, store, `EP-001`..`EP-015`).
- `spec-e-burgos-006-web-studio` — completed (el consumidor de `cycle-02`).

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** `POST /projects/:slug/jobs` **sin body** crea un job de render y devuelve el mismo
  payload que antes del ciclo, verificado con `Object.keys(body).sort()` contra la interfaz del
  `architect.md`, más el campo `kind: "render"`.
- **CA-002:** `POST /projects/:slug/jobs` con `{"kind":"montage"}` sobre un proyecto con `raw/` y
  sin `work/timeline.json` responde `202` con `kind: "montage"`, `location: /jobs/<id>` y el job
  registrado y consultable.
- **CA-003:** Un test verifica que el job de montaje invoca `ingestProject` y `autoMontage` **en ese
  orden**, con el `preset` y el `seed` recibidos, y con las precondiciones evaluadas antes de cada
  una; un proyecto sin directorio de rol en `raw/` falla en la precondición sin invocar ningún
  binario.
- **CA-004:** Un test por cada valor inválido de `preset`, `seed` y `overwrite` verifica el código
  tipado, el status HTTP y que **no** se registró ningún job.
- **CA-005:** `POST` de un job `montage` sobre un proyecto que ya tiene `work/timeline.json`, sin
  `overwrite`, responde `409` con el código propio y `runtime.jobs.listBySlug(slug)` sigue vacío;
  con `overwrite: true` responde `202` (RF-6).
- **CA-006:** Un test verifica la secuencia de etapas observada por el decorador del
  `CommandRunner`: `discover` → `probe` (con contador) → `transcribe` (con contador) → `plan`,
  monotónica; y un segundo test verifica que un proyecto sin nada que probar **saltea** `probe` sin
  romper la monotonía ni el porcentaje.
- **CA-007:** Un test verifica que el decorador del `CommandRunner` es pass-through exacto:
  delega argumentos, opciones y resultado sin alterarlos, y clasifica por la ruta de binario
  resuelta, no por substring del nombre del comando.
- **CA-008:** `DELETE /jobs/:jobId` sobre un job `montage` `queued` responde `200`/`canceled`; sobre
  uno `running` responde `202`/`canceling` y liquida como `canceled` en el próximo checkpoint, con
  `report: null` (RF-8).
- **CA-009:** `GET /health` reporta los cuatro binarios con `name` y `envVar` (nunca la ruta
  resuelta) y `capabilities.montageQueue: true`; un test verifica que con el modelo de Whisper sin
  resolver el `status` es `degraded` y con los cuatro resueltos es `ok` (RF-10, RF-11).
- **CA-010:** `pnpm nx run web:test` pasa **sin modificar un solo archivo de `apps/web`**
  (RNF-2), y `git diff --stat apps/web` está vacío al cerrar el ciclo.
- **CA-011:** `git diff --stat package.json pnpm-lock.yaml` vacío (RNF-3), y
  `pnpm nx run-many -t lint test build` en verde sin warnings (RNF-4).
- **CA-012:** **Smoke real, ejecutado (D-10):** con el binario levantado sobre un
  `RENDER_API_MEDIA_ROOT` temporal que contiene una copia de `media/smoke-ingest` **sin `work/`**
  (sólo `raw/`), un `POST` de job `montage` progresa por las cuatro etapas hasta `succeeded`, y
  `work/catalog.json`, `work/timeline.json` y `work/edl.json` quedan en disco con **el mismo
  `sha256`** que los de `media/smoke-ingest` producidos por la CLI (RF-4, RNF-1).
- **CA-013:** **Smoke real encadenado:** sobre el resultado de CA-012, un `POST` de job `render`
  termina en `succeeded` y el MP4 de `out/<jobId>.mp4` verifica con `ffprobe` **contra el stream de
  video** (`nb_frames` `538`, `r_frame_rate` `30/1`), nunca contra `format.duration`.
- **CA-014:** El oráculo de CA-012 se prueba **sensible**: la misma comparación de `sha256` con un
  `seed` distinto **falla**, y esa corrida queda registrada como evidencia (RNF-1).
- **CA-015:** El README de `apps/render-api` documenta el job de montaje y trae el guion copiable
  del smoke, incluido cómo el binario recibe las cuatro variables del `.env` raíz
  (`set -a && source .env && set +a` o equivalente) y `SWC_NODE_PROJECT=tsconfig.base.json`
  (RF-12).
- **CA-016:** `sdd/api.json` refleja el contrato final con los endpoints tocados en
  `status: "updated"` y su `changelog` del ciclo, y `pnpm sdd:validate` está en verde (RF-13).
