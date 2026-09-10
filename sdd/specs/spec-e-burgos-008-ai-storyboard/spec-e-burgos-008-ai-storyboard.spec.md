# SPEC-e-burgos-008: AI Storyboard: Guion, Escenas y Prompts Visuales

> Estado: **completed** (2026-09-09) — redactada por el actor del ciclo al registrar el backlog
> generativo (2026-09-09); los dos ciclos corrieron con flow `lite` (perfil `solo`, pedido
> `[LITE]`; en `cycle-02` el dev forzó `lite` pese a la sugerencia del validador, que se refería a
> los endpoints creados por `cycle-01`). `cycle-01` entregó el backend completo; `cycle-02` cerró
> la spec con el modo generativo en `apps/web`.

## Resumen Ejecutivo

Las siete specs cerradas hasta hoy construyeron un **montador**: el producto sabe tomar material
que el dev ya grabó (`raw/aroll`, `raw/broll`, `raw/images`), transcribirlo, podar silencios,
elegir B-roll por conceptos, mezclar audio y renderizar un MP4. Lo que no sabe hacer es **decidir
qué video hacer**. Hoy el punto de partida obligatorio es "grabé a cámara"; sin A-roll no hay
transcripción, sin transcripción no hay conceptos y sin conceptos no hay montaje.

Esta spec abre el segundo punto de partida, el que usan de hecho los creadores de contenido: se
parte de una **idea** (o de un guion escrito) y una IA produce el **storyboard** — título, hoja de
personajes con descripción visual consistente, y una lista ordenada de escenas donde cada una
lleva su narración, su **prompt visual** listo para pegar en una herramienta generativa externa
gratuita, y la decisión de con qué se va a llenar ese hueco (material que el usuario sube, un
asset que ya está en el catálogo, o una **escena nativa de Remotion** cuando no hace falta video).

El storyboard es el documento que gobierna todo el resto del backlog generativo: la voz en off
(`spec-009`) se sintetiza escena por escena desde él, el ensamblado (`spec-010`) llena sus huecos
y produce la `Timeline`, la música y los efectos (`spec-011`) se eligen por sus etiquetas, y el
estilo de captions (`spec-012`) se fija por proyecto y por escena dentro de él.

**Invariante que gobierna la spec:** el proyecto no adquiere ninguna dependencia de una API paga
ni de una API key de modelo. La IA se invoca **como proceso local**, `claude -p`, autenticado con
la suscripción ya instalada en la máquina, por el mismo `CommandRunner` inyectable con el que el
motor invoca `ffmpeg`, `ffprobe` y `whisper-cli`. Para el código, la IA es un binario más.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev que origina la spec (2026-09-09): pasar *"de montador por reglas a Video
Maker Studio generativo"*, siguiendo el flujo que usan los creadores de contenido: **guion /
storyboard con IA → un prompt visual por escena con personajes consistentes → el usuario genera
los visuales en herramientas externas gratuitas (Meta AI, Google Flow) y los arrastra numerados a
los huecos de cada escena → voz en off generada localmente → captions alineadas → música y efectos
de un banco libre → render con Remotion**.

El modo actual (montaje desde A-roll, `spec-002` y `spec-007`) **no se retira**: queda como el
modo "grabé a cámara". Esta spec agrega un segundo modo, no reemplaza el primero.

## Evidencia y decisiones

> Citar, no copiar: las entradas referencian el documento origen, no lo reproducen.

- **Evidencia (pedido del dev, 2026-09-09, transcripto arriba):** el flujo objetivo tiene un
  eslabón **manual y externo por diseño** — el usuario genera los visuales en Meta AI o Google
  Flow y los trae de vuelta. El producto no genera imagen ni video: produce el **prompt** y el
  **hueco numerado** donde cae el resultado. Fundamenta D-2 y el `visualPrompt` por escena.
- **Evidencia (referencia analizada: "Automatiza la Creación de Videos con IA", Camino Digital):**
  el flujo del creador es guion → escenas → prompts visuales → generación externa → voz →
  montaje. La consistencia de personajes entre escenas se sostiene con una **hoja de personajes**
  repetida en cada prompt, no con memoria del modelo. Fundamenta el campo `characters` del
  documento y su inyección en cada `visualPrompt`.
- **Evidencia (referencia analizada: "AI Code King clone with Remotion, Gemini & TTS", Ambsd):**
  una parte importante de las escenas de un video técnico **no necesita material generado**:
  títulos, texto grande, bloques de código animados y fotos con Ken Burns se resuelven nativamente
  en Remotion, que este repo ya usa. Fundamenta `visualSource: 'remotion-scene'` y el catálogo
  `title | text | code | image-kenburns`.
- **Decisión del dev (2026-09-09), no negociable:** **sin API key de Anthropic.** La IA corre vía
  Claude Code headless (`claude -p`), autenticado con la suscripción de la máquina. Versión
  medida al abrir el ciclo: `claude` 2.1.123 en `/opt/homebrew/bin/claude`. Fundamenta D-1.
- **Evidencia (`claude -p --help`, leída al abrir `cycle-01`):** el binario soporta
  `--output-format json` (una sola línea JSON en stdout), `--json-schema <schema>` (validación de
  salida estructurada), `--system-prompt`, `--tools ""` (deshabilita **todas** las herramientas),
  `--permission-mode dontAsk` y `--disable-slash-commands`. Fundamenta D-3 y D-4.
- **Evidencia (sonda real ejecutada al abrir `cycle-01`, cwd neutro fuera del repo):** con
  `--output-format json --json-schema … --tools ""` la salida es **un objeto JSON** con
  `type: "result"`, `is_error`, `subtype`, `result` (string vacío cuando hay salida estructurada),
  **`structured_output`** (el objeto ya validado contra el schema) y `usage` con
  `input_tokens`/`output_tokens`/`total_cost_usd`. El contrato de parsing del adaptador se deriva
  de esta medición, no de la documentación. Fundamenta D-4.
- **Evidencia (`apps/render-api/src/jobs/render-job.ts`):** `Job` ya es una **unión discriminada
  por `kind`** (`render | montage`) sobre un `JobBase` común, con `CreateJobInput` paralelo y
  `toJob`/`toJobSummary` exhaustivos. Un tercer `kind` entra por la puerta que `spec-007` ya
  abrió; el costo es la exhaustividad en todos los call sites, que el compilador señala.
  Fundamenta D-5.
- **Evidencia (`apps/render-api/src/deps/render-api-dependencies.ts`):** todo I/O del servicio
  entra por puertos sin estado, y `createCommandRunner` ya expone un `CommandRunner` inyectable.
  Un puerto `aiAgent` es exactamente la misma forma; la suite no necesita red ni proceso hijo.
  Fundamenta D-3 y RNF-3.
- **Evidencia (`libs/timeline-core`, descripción en `sdd/global.json`):** es la lib de
  *"contratos Timeline/EDL y cálculos puros de edición (TypeScript + Zod)"*, y `zod ^4.5` ya es
  dependencia raíz. Zod 4 expone `z.toJSONSchema()`, que es lo que alimenta `--json-schema`.
  Fundamenta D-6.
- **Evidencia (`sdd/api.json` → `EP-012`, actualizado por `spec-007`):** el body de creación de
  job ya se lee y ya discrimina por `kind`, con `render` cuando el campo está ausente. Un tercer
  valor es aditivo y retro-compatible por construcción. Fundamenta D-5.
- **Evidencia (`apps/render-api/README.md` § "Known limits"):** la cola despacha **un** job a la
  vez, FIFO, intra-proceso. Un job de storyboard en la misma cola hereda esa garantía: nunca corre
  a la vez que una transcripción o un render, que es la regla de operación vigente de esta máquina
  (`sdd/memory/lessons.md`).
- **Decisión heredada de `spec-005`:** D-2 cero dependencias npm salvo justificación · D-4 payload
  de máquina en inglés · D-9 `apps/render-api/eslint.config.mjs` descopado por el hook
  `config-protection` · D-11 `RENDER_API_OBJECT_STORE` sólo `fs`.
- **Decisión del dev (perfil `solo`):** todo el backlog generativo se ejecuta en flow `lite`, un
  solo actor con tres sombreros. Las decisiones de producto las toma el actor con recomendación
  fundada y quedan escritas acá.

## Decisiones del orquestador

| ID | Decisión | Fundamento |
| --- | --- | --- |
| **D-1** | **La IA es un binario local, no un servicio.** Puerto `AiAgent` con un único adaptador de producción `ClaudeCliAiAgent` que ejecuta `claude -p` por el `CommandRunner` existente. Cero API keys, cero HTTP saliente, cero SDK. | Es el pedido literal del dev y encaja sin fricción con la arquitectura vigente: el motor ya invoca tres binarios por el mismo puerto. Un SDK traería una dependencia npm, una API key y una segunda forma de fallar; el `CommandRunner` ya tiene timeout, `cwd` y mapeo de `ENOENT` a error tipado. |
| **D-2** | **El producto no genera píxeles.** El storyboard produce un `visualPrompt` por escena y un hueco numerado; la generación de imagen/video ocurre **fuera** del producto, en herramientas gratuitas del usuario. El export de prompts es texto plano numerado, pensado para copiar y pegar. | Es el flujo real del creador (referencia Camino Digital) y la única forma de sostener "sin APIs pagas". Generar visuales dentro del producto exigiría GPU o una API paga: las dos alternativas están descartadas por el dev (HeartMuLa quedó afuera por requerir GPU NVIDIA). |
| **D-3** | **`claude -p` corre con las herramientas deshabilitadas (`--tools ""`), `--permission-mode dontAsk` y `cwd` neutro fuera del repo.** | Tres riesgos distintos, un mismo remedio. Sin herramientas el subproceso no puede leer ni escribir el repo: es un transformador de texto a JSON, no un agente. `cwd` neutro evita que cargue el `CLAUDE.md` de este proyecto y sus settings, que lo convertirían en un orquestador SDD en vez de un guionista. `dontAsk` evita que un prompt de permisos cuelgue el job hasta el timeout. |
| **D-4** | **El adaptador parsea `structured_output` de la salida JSON y la re-valida contra el schema Zod propio**, en vez de confiar en la validación del CLI. | La validación del CLI es de la herramienta, no del contrato: si cambia de versión, de forma o de campo, el defecto entra como datos corruptos en `work/storyboard.json`. Re-validar es una llamada de Zod que ya está en el proceso. El contrato de parsing se derivó de una **sonda real**, no de la documentación. |
| **D-5** | **Un tercer `kind` de job (`storyboard`) en la misma cola**, no un endpoint sincrónico nuevo. `EP-012` pasa a `updated`. | `claude -p` tarda entre segundos y minutos: un POST sincrónico dejaría la conexión abierta y sin cancelación. La cola ya da estado, progreso, cancelación cooperativa e historial, y la **concurrencia 1** garantiza que la generación no compita por CPU con una transcripción o un render. El precedente exacto es `spec-007` D-2. |
| **D-6** | **`StoryboardDocument` (Zod) vive en `libs/timeline-core`, no en `apps/render-api`**, y su JSON Schema se **deriva** del mismo esquema con `z.toJSONSchema()`. | Regla vigente del subproyecto: *"no contiene lógica de motor propia: si un cálculo hace falta, va a una lib"*, y `timeline-core` es la lib de contratos (`TimelineSchema`, `EditDecisionListSchema`). Además `spec-010` produce la `Timeline` **desde** el storyboard dentro de las libs: dejarlo en la app obligaría a moverlo un ciclo después. Derivar el JSON Schema en vez de escribirlo a mano elimina la única forma de que el prompt y el parser diverjan en silencio. |
| **D-7** | **Cuatro errores tipados del agente** (`AI_AGENT_UNAVAILABLE` 503, `AI_AGENT_RATE_LIMITED` 429, `AI_AGENT_FAILED` 502, `AI_AGENT_INVALID_OUTPUT` 502), y ninguno filtra `stderr`, rutas absolutas del host ni `.stack`. | D-4 y D-9 de `spec-005`, vigentes. Los cuatro se distinguen porque exigen **acciones distintas del usuario**: instalar/loguear el CLI, esperar, reintentar, reportar. 502 y no 500 porque el fallo es de un proceso externo cuya salida no pudimos usar: 500 mentiría sobre de quién es el defecto. La cuota (429) es un caso real y esperable de una suscripción compartida, no una excepción. |
| **D-8** | **Dos entradas mutuamente excluyentes: `brief` (una idea) o `scriptText` (un guion ya escrito, a estructurar).** Ninguna de las dos, o las dos a la vez, es `STORYBOARD_INPUT_INVALID` antes de registrar el job. | Son dos tareas distintas para el modelo (inventar vs. segmentar) y dos prompts distintos, pero un mismo documento de salida. Aceptar las dos a la vez obligaría a inventar una precedencia arbitraria que el usuario no puede ver. |
| **D-9** | **Un storyboard existente nunca se pisa por accidente:** sin `overwrite: true` el job se rechaza con `STORYBOARD_ALREADY_EXISTS` y HTTP 409, sin registrar job ni tocar disco. | Idéntico a D-6 de `spec-007` y por la misma razón: el storyboard es material que el usuario edita a mano (`PUT`), y regenerarlo lo descarta. `409` y no `422` porque el pedido es válido: lo bloquea el **estado del recurso**. |
| **D-10** | **Los prompts al modelo se escriben en inglés; el storyboard sale en el idioma del brief.** | Consistente con la regla del repo (payloads e identificadores en inglés) y con el comportamiento medido de los modelos: la instrucción en inglés es más estable, y el idioma de salida es un campo explícito del documento (`language`), no un efecto lateral del prompt. |
| **D-11** | **El smoke con `claude -p` real es criterio de aceptación de `cycle-01`, no un procedimiento documentado**, y su guion copiable vive en `apps/render-api/README.md`. Un **429 de cuota** se registra literal y no bloquea el cierre. | Lección vigente y pagada dos veces en este repo: *"un CA aceptado como procedimiento documentado, nunca ejecutado, no está verificado"*. La excepción por cuota es explícita porque la suscripción es la misma que corre el ciclo: un 429 es evidencia del contrato de error, no una falla de la implementación. |
| **D-12** | **`GET /health` suma `capabilities.storyboardQueue` y NO agrega `claude` a la lista de binarios.** | `capabilities` es un mapa aditivo hecho para esto. Meter `claude` en `MEDIA_BINARY_NAMES` mezclaría dos superficies (binarios de media resueltos por `media-local` vs. el agente) y volvería `degraded` a toda máquina sin Claude Code instalado, incluido CI. Reportarlo con su propia sonda es decisión de un ciclo futuro, anotada como follow-up. |

## Plan de ciclos

| Ciclo | Fase | Flow | Qué entrega | Estado |
| --- | --- | --- | --- | --- |
| **cycle-01** | `storyboard-backend` | `lite` | El contrato `StoryboardDocument` (Zod, en `libs/timeline-core`) con su JSON Schema derivado; el puerto `AiAgent` con adaptador `ClaudeCliAiAgent` sobre `claude -p` y `FakeAiAgent` para la suite; el inventario del proyecto (catálogo, transcripción del A-roll, storyboard previo) que alimenta el prompt; el job `kind: 'storyboard'` con `brief` **o** `scriptText` y `overwrite`; `GET`/`PUT /projects/:slug/storyboard` y `GET /projects/:slug/storyboard/prompts` (texto plano numerado); errores tipados con mapeo HTTP; contrato en `sdd/api.json`; README con el guion copiable; **smoke real ejecutado** contra `claude -p`. | **completed** |
| **cycle-02** | `storyboard-studio` | `lite` | En `apps/web`: panel de brief (idea o guion pegado, idioma, formato), storyboard editable escena por escena (narración, prompt visual, fuente del visual, escena Remotion y sus props, duración estimada), hoja de personajes, progreso del job y botón **copiar prompts** que entrega la lista numerada lista para pegar en Meta AI / Google Flow. Cierra la spec. | **completed** |

## Requisitos Funcionales (RF)

### Ciclo 01 — `storyboard-backend`

- **RF-1:** `libs/timeline-core` exporta `StoryboardDocument` y su schema Zod: `schemaVersion`,
  `title`, `language`, `format` (`9:16 | 16:9 | 1:1`), `characters[]` (`id`, `name`,
  `visualDescription`), `captionsStyle`, `musicTags[]`, `createdAt`, y `scenes[]` ordenadas con
  `id`, `index`, `narration`, `visualPrompt`, `visualSource` (`upload | asset | remotion-scene`),
  `assetId` opcional, `remotionScene` opcional (`title | text | code | image-kenburns` con sus
  props), `estimatedDurationMs`, `captionsStyle` opcional, `musicTags[]` y `sfxTags[]`.
- **RF-2:** El mismo schema exporta un **JSON Schema derivado** (`z.toJSONSchema`) apto para
  `--json-schema`, sin escritura manual paralela (D-6).
- **RF-3:** `apps/render-api` expone el puerto `AiAgent`:
  `propose({ systemPrompt, userPrompt, jsonSchema }) → { json, usage }`, con `usage` en tokens de
  entrada, de salida y costo cuando el proveedor lo reporta.
- **RF-4:** El adaptador `ClaudeCliAiAgent` ejecuta el binario (`CLAUDE_CLI_PATH`, default
  `claude`) por el `CommandRunner` con `-p`, `--output-format json`, `--json-schema`,
  `--system-prompt`, `--tools ""`, `--permission-mode dontAsk`, `--disable-slash-commands`, un
  `cwd` neutro fuera del repo y un timeout configurable; parsea la línea JSON de stdout, toma
  `structured_output` y lo re-valida contra el schema (D-3, D-4).
- **RF-5:** Los cuatro errores del agente (`AI_AGENT_UNAVAILABLE`, `AI_AGENT_RATE_LIMITED`,
  `AI_AGENT_FAILED`, `AI_AGENT_INVALID_OUTPUT`) se disparan cada uno desde una condición real y
  distinta, con mapeo HTTP explícito y sin filtrar `stderr`, rutas absolutas ni `.stack` (D-7).
- **RF-6:** El prompt lleva el **inventario del proyecto**: assets del catálogo (rol, `kind`,
  duración), la transcripción del A-roll si existe, y el storyboard previo si existe.
- **RF-7:** `POST /projects/:slug/jobs` con `kind: "storyboard"` acepta `brief` **o** `scriptText`
  (nunca ambos ni ninguno) y `overwrite` (default `false`), valida antes de registrar el job, y
  ejecuta el pipeline en la misma cola de concurrencia 1 (D-5, D-8).
- **RF-8:** Con `work/storyboard.json` ya presente y sin `overwrite: true`, el job se rechaza con
  `STORYBOARD_ALREADY_EXISTS` y HTTP 409, sin registrar job y sin tocar disco (D-9).
- **RF-9:** `GET /projects/:slug/storyboard` devuelve el documento persistido o
  `404 STORYBOARD_NOT_FOUND`; `PUT` valida contra el schema y persiste, rechazando con
  `STORYBOARD_INVALID` lo que no valide.
- **RF-10:** `GET /projects/:slug/storyboard/prompts` devuelve **texto plano** con la hoja de
  personajes y un prompt por escena, **numerado desde `01`**, para copiar a la herramienta externa
  y para que el archivo devuelto se pueda nombrar por número (D-2).
- **RF-11:** El progreso del job se reporta por el mismo mecanismo que render y montaje, con
  etapas propias y monotónicas, y la cancelación es cooperativa con la misma semántica.
- **RF-12:** `GET /health` reporta `capabilities.storyboardQueue: true` sin alterar ningún otro
  campo (D-12).
- **RF-13:** El contrato queda registrado en `sdd/api.json` (endpoints nuevos y los tocados en
  `updated`, con su `changelog`), y el README de `apps/render-api` documenta el tipo de job, sus
  parámetros, sus errores, las variables de entorno nuevas y el guion copiable del smoke.

## Requisitos No-Funcionales (RNF)

- **RNF-1:** **Sin API key y sin red propia.** Ninguna variable de tipo `ANTHROPIC_API_KEY` entra
  al proyecto, y ningún archivo del repo contiene un secreto. Las variables nuevas se documentan
  en el README y en el contexto del subproyecto, nunca con su valor.
- **RNF-2:** **La suite jamás llama a `claude` ni a la red.** Todo test usa `FakeAiAgent` o un
  `CommandRunner` doble; `pnpm nx run render-api:test` corre en una máquina sin Claude Code.
- **RNF-3:** Cero dependencias npm nuevas: `git diff --stat package.json pnpm-lock.yaml` vacío al
  cerrar el ciclo.
- **RNF-4:** `pnpm nx run-many -t lint test build` en verde y sin warnings para todo el workspace.
- **RNF-5:** Cobertura de `apps/render-api` por encima del piso de su `vite.config.ts`, con
  `coverage.include` **sin recortar**; ídem `libs/timeline-core`.
- **RNF-6:** 100 % compatible hacia atrás: ningún campo publicado de `EP-001`..`EP-015` cambia de
  nombre, tipo ni semántica, y `apps/web` no se toca.
- **RNF-7:** Sin comentarios en el código; identificadores, payloads, commits y README en inglés;
  documentos SDD en español.
- **RNF-8:** El material del dev (`media/`) no se modifica: toda verificación real corre sobre
  copias en un `RENDER_API_MEDIA_ROOT` temporal.

## Dependencias

- Subproyectos: `apps/render-api` y `libs/timeline-core` (`cycle-01`), `apps/web` (`cycle-02`).
- Consume sin modificar: `libs/auto-montage` (proyecto de medios, catálogo, serialización).
- `spec-e-burgos-005-render-service` — completed (cola de jobs, store, puertos).
- `spec-e-burgos-006-web-studio` — completed (el consumidor de `cycle-02`).
- `spec-e-burgos-007-web-montage` — completed (la unión discriminada `Job` por `kind`).
- Herramienta externa: `claude` (Claude Code CLI) instalado y autenticado en la máquina del dev.

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** Un test valida el ida y vuelta del `StoryboardDocument`: un documento mínimo y uno
  completo parsean, y un documento con `visualSource: 'remotion-scene'` sin `remotionScene`, o con
  props que no corresponden a su `kind`, es rechazado.
- **CA-002:** Un test verifica que el JSON Schema **se deriva** del schema Zod y que el objeto de
  ejemplo del documento valida contra el JSON Schema derivado (RF-2).
- **CA-003:** Un test por cada error del agente (`AI_AGENT_UNAVAILABLE`, `AI_AGENT_RATE_LIMITED`,
  `AI_AGENT_FAILED`, `AI_AGENT_INVALID_OUTPUT`) verifica que **puede dispararse** desde una salida
  real del CLI, su status HTTP y que el payload no contiene `stderr`, rutas absolutas ni `.stack`.
- **CA-004:** Un test verifica los argumentos exactos con los que el adaptador invoca el binario:
  `--tools ""`, `--permission-mode dontAsk`, `--output-format json`, `--json-schema` con el schema
  derivado, y un `cwd` que **no** es la raíz del repo (D-3).
- **CA-005:** Un test verifica que el prompt incluye el inventario (assets del catálogo, la
  transcripción del A-roll y el storyboard previo) cuando existen, y que no lo incluye cuando no
  (RF-6).
- **CA-006:** Un test por cada combinación inválida de entrada (`brief` y `scriptText` juntos,
  ninguno de los dos, `overwrite` no booleano) verifica el código tipado, el status y que **no** se
  registró ningún job.
- **CA-007:** `POST` con `kind: "storyboard"` sobre un proyecto con `work/storyboard.json`, sin
  `overwrite`, responde `409 STORYBOARD_ALREADY_EXISTS` y el listado de jobs del proyecto sigue
  vacío; con `overwrite: true` responde `202` (RF-8).
- **CA-008:** `GET`/`PUT /projects/:slug/storyboard` verifican el set completo de claves del
  payload con `Object.keys(body).sort()` contra la interfaz declarada, no campo por campo.
- **CA-009:** Un test verifica el export de prompts: numerado desde `01`, un bloque por escena, la
  hoja de personajes presente, `content-type` de texto plano (RF-10).
- **CA-010:** Un test verifica la secuencia monotónica de etapas del job y la cancelación
  cooperativa (`queued → canceled` 200, `running → canceling` 202) con `report: null` (RF-11).
- **CA-011:** `GET /health` reporta `capabilities.storyboardQueue: true` y ningún otro campo
  cambia (RF-12).
- **CA-012:** `git diff --stat package.json pnpm-lock.yaml` vacío (RNF-3) y
  `pnpm nx run-many -t lint test build` en verde sin warnings (RNF-4).
- **CA-013:** **Smoke real, ejecutado (D-11):** con el binario de `apps/render-api` levantado sobre
  una copia temporal de `media/smoke-ingest`, un job `storyboard` con un brief real llega a
  `succeeded` invocando `claude -p` de verdad; `work/storyboard.json` queda en disco y valida
  contra el schema. El prompt enviado y la respuesta literal del modelo quedan en
  `cycles/cycle-01/artifacts/`. Un `429` de cuota se registra literal y cierra el CA como
  "ejecutado con error de cuota".
- **CA-014:** **Smoke real de la rama `scriptText`:** el mismo procedimiento con un guion pegado
  produce un storyboard cuyas escenas respetan el texto entregado.
- **CA-015:** **Smoke real del export:** `GET /projects/:slug/storyboard/prompts` sobre el
  resultado del smoke devuelve la lista numerada, y queda registrada en `artifacts/`.
- **CA-016:** `sdd/api.json` refleja el contrato final (endpoints nuevos + tocados en `updated` con
  su `changelog`) y `pnpm sdd:validate` está en verde.
