# SPEC-e-burgos-005: Local Render Service & Asset Storage

> Estado: **completed** — detallada por el sdd-orchestrator al abrir `cycle-01`, ampliada al abrir
> `cycle-02` y `cycle-03`, y cerrada por el sdd-reviewer al cerrar `cycle-03` (2026-09-08).

## Resumen Ejecutivo

Servicio local Node (`apps/render-api`) que expone una API REST para gestionar assets crudos en MinIO (docker-compose del repo), encolar jobs de render headless (Remotion + FFmpeg) con progreso y cancelación, y persistir timelines/EDL generadas. Corre en la máquina del dev; no tiene autenticación multiusuario ni despliegue cloud en su alcance inicial.

> **Corrección (D-11, `cycle-02`):** MinIO quedó **descopado con fundamento** y nunca se implementó.
> El store del servicio es el filesystem sobre `media/<project-slug>/`, detrás del puerto
> `ObjectStorage` con un único adaptador `fs`. El párrafo de arriba es el alcance **previsto** al
> abrir la spec; el vigente es el de D-11.

`apps/render-api` es además **el único subproyecto del monorepo que puede depender a la vez de
`libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`)**: los `depConstraints`
del `eslint.config.mjs` raíz impiden que esas dos libs se importen entre sí, y el tag `type:app`
cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`. Por eso la orquestación
`render → mix → mux → verify` en una sola llamada es de esta spec y de ninguna otra.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** endpoints de assets (upload/list/probe), jobs de render (create/status/cancel), storage de `Timeline`/`EditDecisionList` como JSON, cola en proceso con concurrencia 1.

## Evidencia y decisiones

> Citar, no copiar. Las entradas de abajo referencian el documento origen, no lo reproducen.

- **Evidencia (spec-004 cycle-02, `architect.md` §15):** la API pública de las dos libs a consumir
  (`renderTimeline` con `audio: 'muted'`, `mixTimelineAudio`, `muxAudioIntoVideo`,
  `verifyMixLoudness`), el orden no conmutable de las cuatro llamadas y la tabla de errores
  (§15.2) que esta spec tiene que traducir a payload HTTP.
- **Evidencia (spec-004 cycle-02, `cycle.json → reviewer_report.follow_ups`):** cuatro follow-ups
  heredados, todos con dueño en esta spec (orquestación, `coverage.include` de
  `composition-remotion`, re-master del integrado, paridad de `gainDbToVolume`).
- **Evidencia (spec-002 cycle-03, constitución de `tools/render-cli` §4 "Pendientes"):** N-2
  (superficie de errores con token genérico `[uso]`) y el bilingüismo de la salida de la CLI,
  declarados explícitamente "decisión a tomar en spec-005, donde pasan a ser payload de API".
- **Evidencia medida (`tools/render-cli`, 2026-09-08):** `nx run <proj>:<target>` normaliza todo
  fallo de `nx:run-commands` a exit code `1`; el exit code exacto sólo se observa invocando el
  binario. Cualquier verificación de códigos de salida de esta spec invoca el proceso, no el target.
- **Decisión del dev (2026-09-07, desglose de módulos):** el servicio corre en la máquina del dev,
  sin auth multiusuario ni despliegue cloud. Concurrencia 1 en la cola.
- **Decisión del dev (D-3, vigente):** `media/` es el store canónico en disco. MinIO es la **vista**
  que `render-api` expone sobre ese store, nunca una segunda copia del material.
- **Decisión del dev (directiva de entrega):** ante una decisión de producto fuera de spec, el
  orquestador decide con recomendación fundada y la deja escrita.

## Decisiones del orquestador

| Id | Decisión | Fundamento |
| --- | --- | --- |
| **D-1** | La spec se ejecuta en **tres ciclos** (ver "Plan de ciclos"). | El alcance mezcla tres ejes independientes (proceso/pipeline, store de assets, cola de jobs). Partirlo por eje deja cada ciclo por debajo de dos semanas y da un entregable verificable por ciclo. |
| **D-2** | **Cero dependencias npm nuevas en `cycle-01`**: servidor sobre `node:http`, router propio, `node:util parseArgs` para el arranque. | El servicio es local, mono-usuario y sin auth: Express/Fastify aportarían un segundo modelo de errores y middleware que esta superficie no usa. `tools/render-cli` ya demostró que el patrón (puertos inyectables + frontera de proceso única) escala sin framework. Se revisa en `cycle-02` sólo si el upload de assets lo exige; la alternativa preferida allí sigue siendo streaming crudo (`PUT` con body binario), no multipart. |
| **D-3** | `media/<project-slug>/` es el store canónico; MinIO es una vista sobre él. `cycle-01` **no toca MinIO**. | Decisión del dev heredada. Duplicar los medios en un bucket rompe la trazabilidad de `tools/render-cli`, que lee y escribe ese mismo árbol. |
| **D-4** | **Todo payload de máquina de `render-api` es inglés** (`code`, `stage`, `resource`, `expected`, `hint`), igual que identificadores, commits y docs técnicos. Los documentos SDD siguen en español. | Un payload de API es contrato de máquina y consumidor de un frontend (`spec-006`): un `causa:` en castellano obliga a cada consumidor a traducir o a acoplarse al idioma. Regla del repo: código, identificadores y payloads en inglés. |
| **D-5** | **N-2 de `tools/render-cli` (token genérico `[uso]`) y su salida bilingüe NO se tocan en `cycle-01`**; se agendan como `[IMPROVEMENT]` con FIX GATE propio en `cycle-03`. | Hoy sería un cambio cosmético sin consumidor. En `cycle-03` la API y la CLI comparten la traducción de errores de las libs y el cambio se valida contra un consumidor real; hacerlo antes obliga a rehacerlo. |
| **D-6** | **`coverage.include` de `libs/composition-remotion/vite.config.ts` se amplía a `src/render.ts` en `cycle-03`**, como `[IMPROVEMENT]` con FIX GATE propio, no en `cycle-01`. | Ampliar el `include` hoy baja el porcentaje medido sin agregar un solo test y pondría en rojo un umbral ajeno al ciclo. `cycle-03` es el ciclo que ejercita `render.ts` de verdad (smoke E2E), así que es el que puede subir la cobertura y el piso a la vez. |
| **D-7** | **Política ante `withinTolerance: false`: publicar el entregable y reportar el delta**; no reintentar, no lanzar. | El master bus ya garantiza el true peak (`spec-004` D-21). El integrado fuera de tolerancia es información editorial —bajar la cama musical es una decisión de edición, no del servicio— y un reintento automático duplicaría el costo del render sin garantía de converger. `spec-004` §15.3.3 deja la política explícitamente a esta spec. |
| **D-8** | **Los intermedios se conservan**: el pipeline crea el workdir y no borra `video-muted.mp4` ni `master.wav`. | `spec-004` §15.3.6 los deja al llamador y ffmpeg no crea el directorio de salida. Conservarlos hace baratos el re-mux y la depuración, y habilita reinyectar `mix.voiceMeasured` (§15.3.7) para re-mezclar con **una** invocación de ffmpeg en vez de dos. |
| **D-9** | **`apps/render-api/eslint.config.mjs` queda descopado**: no se crea. El lint cae al flat config raíz y los boundaries se cumplen por el fallback `type:app` → `*`. El contenido propuesto queda en `architect.md`. | El hook `config-protection` del harness del dev bloquea `Write|Edit` sobre cualquier archivo de basename `eslint.config.mjs`, sin distinguir raíz de proyecto, y rodearlo con `Bash` anularía el guardrail. Mismo tratamiento ya aplicado en `tools/render-cli`. Reversible en un paso. |
| **D-10** | **`cycle-01` verifica compilar + ejecutar + resolver ambas libs en un proceso real**; el bundle webpack de Remotion se ejercita en el smoke E2E de `cycle-03`. Se declara explícitamente como **no verificado** en `cycle-01`. | Bundlear Remotion sin renderizar cuesta el mismo tiempo y memoria que el render entero, y `cycle-01` no tiene todavía un job que lo dispare. Declararlo como pendiente evita el defecto de `FIX-e-burgos-001-001` (un smoke roto durante dos specs sin que nadie lo supiera). |
| **D-11** | **MinIO queda descopado como backend de objetos.** Se conserva el **puerto** `ObjectStorage` con un único adaptador `fs` sobre `media/`, y la variable `RENDER_API_OBJECT_STORE` (hoy solo acepta `fs`) como punto de extensión documentado. `docker-compose.yml` no se toca y el README declara que `render-api` no lo consume. | "MinIO como vista sobre `media/`" (D-3) es **técnicamente imposible** en las versiones vigentes: MinIO eliminó el modo FS/gateway legacy en `RELEASE.2022-10-29T06-21-33Z` y desde `RELEASE.2022-06-02` un despliegue single-node single-drive usa un backend erasure-coded de paridad cero con `.xl.meta` — los archivos que ya están en disco **no** son objetos, y los objetos que MinIO escribe **no** son archivos legibles fuera de MinIO. La única forma de tener el bucket sería `mc mirror`, es decir la segunda copia que D-3 prohíbe. Además el único consumidor de URLs firmadas (`apps/web`, `spec-006`) todavía no existe y el servicio escucha en `127.0.0.1`, donde una URL firmada no aporta ninguna garantía que el proceso mismo no dé ya. Reversible en un paso: implementar `MinioObjectStorage` detrás del mismo puerto cuando `spec-006` traiga un consumidor real. Con esto **D-2 (cero dependencias npm) se sostiene también en `cycle-02`**. |
| **D-12** | **`apps/render-api` es el único escritor legítimo de `raw/`**, y escribe exclusivamente dentro de `raw/<role>/` y `work/`. | `libs/auto-montage` trata `raw/` como entrada inmutable (`guardWriteTextFile` → `ReadOnlyRawPathError`): para ella el material crudo ya existe. El upload de assets es justamente el acto de **crear** ese material, así que ese guard no aplica al store de la API. La otra mitad del guard sí aplica y se replica: ninguna ruta recibida por HTTP puede escapar del proyecto (`toProjectRelativePath` + `ProjectRelativePathSchema`). |
| **D-13** | **El store reusa la capa de proyecto de `libs/auto-montage`** (`resolveMediaProject`, `readCatalog`, `writeCatalog`, `writeTimeline`, `writeEditDecisionList`, `ProjectRelativePathSchema` y los helpers de `project-paths`); no reimplementa el layout `media/<slug>/`. | El dev alterna `tools/render-cli` y `render-api` sobre la misma carpeta. Dos definiciones del layout divergen en el primer cambio y el síntoma aparece recién cuando el catálogo escrito por una herramienta no valida en la otra. `apps/render-api` (`type:app`) ya puede depender de `auto-montage` por el fallback de los `depConstraints`. |
| **D-14** | **Upload por `PUT` con body binario crudo**, nunca multipart. `content-type` y `content-length` obligatorios, límite de tamaño por variable de entorno, escritura a archivo temporal dentro del mismo proyecto y `rename` atómico al destino final. | Es la alternativa que D-2 ya declaró preferida. Un parser multipart propio es superficie de ataque y de bugs sin ningún consumidor que lo pida (`fetch` con un `File` como body hace `PUT` binario en una línea). El temporal + `rename` evita que un upload cortado deje medio asset en `raw/`, que es material del dev y no un intermedio descartable. |
| **D-15** | **El upload deja `work/catalog.json` consistente en la misma request**: escribe el asset, lo sondea con `probeMedia` y funde su entrada en el catálogo con `writeCatalog`. Si el probe falla, el asset **no se borra** y la falla se registra en `probeFailures` del catálogo; la respuesta es el error tipado correspondiente. | Un asset en `raw/` sin entrada en el catálogo es invisible para `autoMontage`, y un catálogo que quedó viejo porque el `POST /probe` opcional nunca se llamó miente en silencio. El `CatalogSchema` ya tiene `probeFailures` para expresar exactamente ese estado, así que no hace falta inventar nada. Borrar el archivo ante un probe fallido destruiría material del dev por un problema de herramienta. |
| **D-16** | **`Timeline` y `EDL` se persisten con los mismos paths y los mismos bytes que la CLI**, reusando `writeTimeline`/`writeEditDecisionList` de `auto-montage` y validando en el `PUT` con `TimelineSchema`/`EditDecisionListSchema`. | Lección medida del repo: el orden de claves de `JSON.stringify` tras un `.parse()` de Zod es el del schema, no el del literal. Si la API serializara por su cuenta, alternar CLI y API sobre el mismo proyecto produciría un diff espurio en cada `PUT` y nadie sabría cuál de las dos escribió mal. |
| **D-17** | **La descarga de artefactos se sirve desde el propio proceso** (`GET` de bytes con soporte de `Range` de un solo rango y `content-type` derivado por una tabla propia de extensiones). Es lo que reemplaza a la URL firmada de MinIO. | Sin `Range` un `<video>` no puede hacer seek (Safari directamente no reproduce), y el consumidor previsto de `spec-006` es exactamente un `<video>` y el Remotion Player. Servirlo desde el proceso mantiene `media/` como única copia (D-3) y cero dependencias (D-2). |

## Plan de ciclos

| Ciclo | Fase | Qué entrega | Estado |
| --- | --- | --- | --- |
| **cycle-01** | `render-service-foundation` | La app `apps/render-api` existente y ejecutable; puertos inyectables; la orquestación `render → mix → mux → verify` en una sola llamada; la superficie de errores tipada en inglés con su mapeo a HTTP; servidor `node:http` con `GET /health`. Sin cola, sin MinIO, sin endpoints de assets. | **completed** |
| **cycle-02** | `asset-store-and-project-persistence` | Store de assets sobre `media/` (D-3): listar proyectos y assets, subir un asset, sondearlo con `probeMedia`; persistencia de `Timeline`/`EditDecisionList` como JSON en `work/`; descarga de artefactos por HTTP. La vista MinIO queda **descopada con fundamento** (D-11): el puerto `ObjectStorage` queda con un solo adaptador `fs`. | **completed** |
| **cycle-03** | `render-job-queue-and-delivery` | Cola en proceso con concurrencia 1; `POST /jobs`, `GET /jobs/:id`, `DELETE /jobs/:id`; progreso por etapa y por frame; **smoke real E2E obligatorio** (job disparado por HTTP que termina en un MP4 verificado con `ffprobe` contra el stream de video); `FIX-e-burgos-001-001` → `validated`; los `[IMPROVEMENT]` de D-5 y D-6; cierre de la spec. | **completed** |

## Requisitos Funcionales (RF)

### Ciclo 01 — `render-service-foundation`

- **RF-1:** Existe la app Nx `apps/render-api` (`projectType: application`, tags `scope:engine` y
  `type:app`) con targets `lint`, `test`, `build` y un target de arranque, integrada al workspace
  pnpm y sin placeholders del generador.
- **RF-2:** Todo el I/O del servicio entra por puertos inyectables agrupados en un único objeto de
  dependencias (render, mix, mux, verify, filesystem, reloj, logger). Ningún módulo instancia I/O
  por su cuenta; el adaptador de producción es el único archivo que resuelve los puertos reales,
  con `await import()` dinámico para las dos libs pesadas.
- **RF-3:** Una sola función orquesta el pipeline completo `render (audio: 'muted') → mix → mux →
  verify` en ese orden, crea el directorio de trabajo antes del primer paso, conserva los
  intermedios (D-8) y devuelve un reporte tipado con las rutas producidas y la medición de
  loudness del entregable.
- **RF-4:** Existe una superficie de errores tipada propia que traduce cada fila de la tabla de
  errores de `spec-004` §15.2 a un código propio, una etapa del pipeline y un status HTTP, con
  payload de máquina en inglés (D-4) y sin filtrar `.stack` ni rutas absolutas del host.
- **RF-5:** Un servidor HTTP local sobre `node:http` con router por método y path, `GET /health`
  que responde 200 con el estado del servicio y de los binarios resueltos, respuesta JSON en todos
  los caminos y un manejador central de errores que usa el mapeo de RF-4. Host y puerto se
  configuran por variables de entorno con default local.
- **RF-6:** Ante `withinTolerance: false` el pipeline publica el entregable y reporta el delta
  (D-7); no reintenta ni lanza.
- **RF-7:** El README del subproyecto documenta el procedimiento, los comandos, las variables de
  entorno y qué quedó explícitamente fuera de `cycle-01` (MinIO, cola, assets, bundle de Remotion).

### Ciclo 02 — `asset-store-and-project-persistence`

- **RF-8:** El servicio resuelve una **raíz de medios** configurable (`RENDER_API_MEDIA_ROOT`, default
  `media`) y expone los proyectos que viven bajo ella. Listar proyectos devuelve, por cada uno, su
  slug y la presencia de los artefactos del layout (`raw/`, `work/catalog.json`, `work/timeline.json`,
  `work/edl.json`, `out/`); el detalle de un proyecto agrega el conteo de assets por rol.
- **RF-9:** Se puede **crear** un proyecto vacío por HTTP: la API materializa el layout canónico
  (`raw/aroll`, `raw/broll`, `raw/images`, `raw/audio`, `work/`, `out/`) y falla con un error tipado
  si el slug ya existe o no es un segmento de path portable.
- **RF-10:** Se pueden **listar los assets** de un proyecto. La fuente de verdad es
  `work/catalog.json` cuando existe; si no existe, la respuesta se arma recorriendo `raw/` y lo
  declara explícitamente en el payload, sin escribir nada.
- **RF-11:** Se puede **subir un asset** con `PUT` y body binario crudo (D-14) a `raw/<role>/<filename>`.
  El rol y el nombre de archivo se validan antes de tocar el filesystem; la escritura es a temporal
  + `rename`; el tamaño máximo es configurable por variable de entorno.
- **RF-12:** El upload **sondea el asset con `probeMedia` y actualiza `work/catalog.json` en la misma
  request** (D-15), manteniendo el orden ascendente por `asset.id` que exige `CatalogSchema` y
  registrando la falla en `probeFailures` si el probe no pudo completarse.
- **RF-13:** Se pueden **leer y escribir la `Timeline` y la `EditDecisionList`** del proyecto
  (`work/timeline.json`, `work/edl.json`). El `PUT` valida contra los schemas de
  `@video-maker/timeline-core` antes de escribir y serializa con los helpers de `auto-montage`
  (D-16); el `GET` de un artefacto ausente es un error tipado, nunca un `null`.
- **RF-14:** Se pueden **descargar los artefactos** del proyecto (`out/**` y `work/**`) como bytes,
  con `content-type` derivado de la extensión y soporte de `Range` de un solo rango (D-17). El
  acceso a `raw/**` por esta vía se sirve igual (es material del proyecto), pero ninguna ruta puede
  escapar del proyecto ni de la raíz de medios.
- **RF-15:** Todo el I/O nuevo entra por puertos inyectables sumados a `RenderApiDependencies`
  (`ObjectStorage` y los puertos de proyecto/catálogo), armados únicamente en el adaptador de
  producción, que vuelve a recibir la raíz de medios además del `env`.
- **RF-16:** La superficie de errores se amplía con los códigos del store, cada uno con su etapa
  (`null` para los de transporte) y su status HTTP, en inglés y sin `.stack` ni rutas absolutas.
  `GET /health` refleja `capabilities.assetStore: true`.
- **RF-17:** El README del subproyecto documenta los endpoints nuevos, las variables de entorno
  nuevas, la decisión D-11 (por qué no hay MinIO y cómo se agregaría) y qué sigue fuera de alcance.

### Ciclo 03 — `render-job-queue-and-delivery`

- **RF-18:** Existe una cola de jobs de render en proceso, en memoria, con concurrencia 1: un único
  job en estado `running` a la vez en todo el proceso, sin importar de qué proyecto sea; el resto
  queda `queued` en orden de llegada (FIFO).
- **RF-19:** Se puede crear un job de render sobre un proyecto identificándolo sólo por su slug. El
  job lee la `Timeline` del proyecto desde `work/timeline.json` a través del store existente
  (D-13) en el momento en que la necesita; nunca la acepta por body. Si el proyecto no existe, o su
  `Timeline` no existe o no valida, la respuesta es un error tipado y ningún job queda registrado.
- **RF-20:** Se puede consultar un job por su identificador: expone su estado (`queued` | `running`
  | `succeeded` | `failed` | `canceled`), la etapa vigente del pipeline (`prepare` | `render` |
  `mix` | `mux` | `verify`) cuando está `running`, y — durante la etapa `render` — el progreso por
  frame. Un job `failed` embebe el error tipado completo (código, etapa, recurso) de la falla, y la
  consulta en sí sigue respondiendo con éxito de transporte.
- **RF-21:** Se pueden listar los jobs de un proyecto puntual, en el orden en que se crearon; el
  listado nunca incluye jobs de otro proyecto.
- **RF-22:** Se puede cancelar un job, con semántica explícita y distinta según su estado: un job
  `queued` se cancela de verdad (nunca llega a ejecutarse); un job `running` no se interrumpe a
  mitad de la invocación de un binario, pero termina en un estado observable y distinguible de
  `succeeded`/`failed`; cancelar un job ya finalizado es un error tipado que no cambia su estado
  final.
- **RF-23:** El puerto `RenderMutedVideoPort` se extiende para aceptar y propagar, sin alterarlo, el
  callback `onProgress(renderedFrames, totalFrames)` que `renderTimeline` ya expone, de modo que el
  progreso por frame de la etapa `render` llegue al estado del job.
- **RF-24:** El entregable de un job se publica en `out/<renderId>.mp4` y sus intermedios se
  conservan en `work/renders/<renderId>/` (D-8), con la misma política de conservación que la
  llamada directa a `runRenderPipeline` (`cycle-01`): ningún resultado del job borra un intermedio.
- **RF-25:** La superficie de errores se amplía con los códigos propios de la cola (job inexistente,
  cancelación no permitida por estado, etc.), cada uno con su etapa (`null` si no aplica) y su
  status HTTP, en inglés y sin `.stack` ni rutas absolutas del host (D-4).
- **RF-26:** `GET /health` refleja la capacidad de la cola de jobs en `capabilities`, sin alterar el
  cálculo de `status` (`ok`/`degraded`), que sigue dependiendo únicamente de motores y binarios.
- **RF-27:** Existe un smoke real E2E obligatorio: un job disparado por HTTP sobre un proyecto real
  de `media/` produce un MP4 cuya duración se verifica con `ffprobe` contra el **stream de video**
  (`nb_frames` dividido por `r_frame_rate` parseado como fracción), nunca contra `format.duration`;
  la salida literal del smoke queda guardada como artefacto del ciclo.
- **RF-28:** El smoke real E2E de RF-27 es la evidencia que permite marcar
  `FIX-e-burgos-001-001` como `validated` en `sdd/fixes.json` al cerrar el ciclo.
- **RF-29:** El README del subproyecto documenta los endpoints nuevos de la cola, la semántica de
  cancelación por estado, las limitaciones conocidas (concurrencia 1, cola en memoria sin
  persistencia entre reinicios) y el resultado del smoke E2E.

## Requisitos No-Funcionales (RNF)

- **RNF-1:** Cero dependencias npm nuevas en `cycle-01` (D-2). Sólo módulos nativos de Node y los
  paquetes `@video-maker/*` ya existentes.
- **RNF-2:** Cobertura mínima **80 %** de statements sobre los archivos propios de
  `apps/render-api`, con el `coverage.include` apuntando explícitamente a `src/**` del proyecto.
- **RNF-3:** La suite de tests corre **sin** ffmpeg, ffprobe, whisper-cli ni Chrome: todos los
  puertos se doblan. Ningún `*.spec.ts` importa `execa`, `child_process` ni las libs pesadas por su
  entrada real.
- **RNF-4:** TypeScript estricto, sin `any`; código sin comentarios (regla del repo).
- **RNF-5:** No se modifica ninguna config protegida por el hook `config-protection`
  (`eslint.config.mjs` de cualquier nivel, `tsconfig.base.json`). Si hiciera falta, se escala al dev
  con el diff y se sigue con lo que no dependa de eso.
- **RNF-6:** El servicio no escucha fuera de `127.0.0.1` por default y no expone rutas absolutas del
  host en ningún payload.
- **RNF-7:** **Cero dependencias npm nuevas también en `cycle-02`** (D-11 lo hace posible). Sólo
  módulos nativos de Node y paquetes `@video-maker/*` ya existentes.
- **RNF-8:** Ninguna ruta recibida por HTTP puede escapar del proyecto ni de la raíz de medios: la
  validación ocurre **antes** de cualquier llamada al filesystem, y el payload de salida usa siempre
  rutas relativas al proyecto (extiende RNF-6 al store).
- **RNF-9:** La suite sigue corriendo sin ffmpeg, ffprobe, whisper-cli ni Chrome (RNF-3): el
  filesystem entra por el puerto `ObjectStorage` y los tests que necesitan disco real usan un
  directorio temporal, nunca `media/`.
- **RNF-10:** Cobertura ≥ 80 % de statements sobre `src/**` de `apps/render-api` sostenida, sin
  reducir el `coverage.include` vigente para lograrlo.
- **RNF-11:** **Cero dependencias npm nuevas también en `cycle-03`** (D-2). Sólo módulos nativos de
  Node y paquetes `@video-maker/*` ya existentes.
- **RNF-12:** La cola de jobs vive únicamente en memoria del proceso: no persiste entre reinicios
  del servicio, y el README lo declara explícitamente como límite conocido.
- **RNF-13:** El smoke real E2E (RF-27) corre con binarios reales (ffmpeg, ffprobe, Chrome headless)
  fuera de la suite de tests habitual, que sigue corriendo sin ellos (RNF-3/RNF-9); la salida
  literal del smoke se guarda como artefacto del ciclo, no sólo se relata en el reporte de cierre.

## Dependencias

- Subproyectos: `apps/render-api` (nuevo), `libs/media-local`, `libs/composition-remotion`,
  `libs/timeline-core`, `libs/auto-montage`
- `spec-e-burgos-001-core-composition-media-pipeline` (completed)
- `spec-e-burgos-002-auto-montage-pipeline` (completed)
- `spec-e-burgos-004-audio-mix-mastering` (completed) — la API de §15 que esta spec consume

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** `pnpm nx run-many -t lint test build` termina en verde con `render-api` incluido en la
  corrida, sin warnings nuevos respecto del baseline conocido.
- **CA-002:** Una **ejecución real del proceso** (no un test) arranca el servidor, responde
  `GET /health` con 200 y un JSON válido, resuelve por `await import()` `@video-maker/media-local`
  y `@video-maker/composition-remotion/render` sin error, y termina con exit code 0 ante una señal
  de apagado. El exit code se observa invocando el proceso, nunca `nx run`.
- **CA-003:** Un test verifica que el pipeline invoca las cuatro operaciones **en orden** y que el
  paso de render recibe `audio: 'muted'`; el orden se comprueba sobre un registro de llamadas, no
  por el título del test.
- **CA-004:** Cada fila de la tabla de errores de `spec-004` §15.2 tiene un test que la traduce al
  código, la etapa y el status HTTP esperados, y ninguno de esos payloads contiene texto en
  castellano ni `.stack`.
- **CA-005:** Un test verifica que el directorio de trabajo se crea **antes** del primer paso y que
  ningún camino del pipeline borra los intermedios.
- **CA-006:** `withinTolerance: false` produce un reporte exitoso con el delta poblado; no lanza y
  no dispara un segundo render (verificado sobre el registro de llamadas).
- **CA-007:** Cobertura de `apps/render-api` ≥ 80 % de statements sobre su propio `src/**`, con el
  `include` declarado en el `vite.config.ts` del proyecto.
- **CA-008:** `apps/render-api/README.md` documenta comandos, variables de entorno y el alcance
  descopado de `cycle-01` (MinIO, cola, assets, bundle webpack de Remotion, `eslint.config.mjs`).

### Ciclo 02

- **CA-009:** `pnpm nx run-many -t lint test build` termina en verde con `render-api` incluido, y
  `pnpm sdd:validate` en verde, sin dependencias npm nuevas (`package.json` y `pnpm-lock.yaml` sin
  cambios en todo el ciclo).
- **CA-010:** Un test verifica que una ruta con `..`, absoluta, con separador de Windows o con
  esquema de URI es rechazada **antes** de que se invoque ningún puerto de filesystem, comprobado
  sobre el registro de llamadas (no por el título del test).
- **CA-011:** Un test verifica que el upload escribe a un temporal y renombra: ante un fallo de
  escritura a mitad de camino no queda ningún archivo en el destino final de `raw/`.
- **CA-012:** Un test verifica que tras un upload exitoso `work/catalog.json` contiene la entrada del
  asset nuevo, ordenada ascendentemente por `asset.id` junto a las preexistentes, y que el resultado
  vuelve a validar contra `CatalogSchema`.
- **CA-013:** Un test verifica que ante `probeMedia` fallido el asset **sigue escrito** y la falla
  quedó en `probeFailures` del catálogo, con el `errorCode` correspondiente.
- **CA-014:** Un test verifica que el `PUT` de `Timeline` rechaza con error tipado un documento que
  no valida contra `TimelineSchema` y que **no escribe nada**; y que un documento válido produce
  exactamente los mismos bytes que escribe `writeTimeline` de `auto-montage` (comparación de bytes,
  no de objeto). Idéntico para la `EditDecisionList`.
- **CA-015:** Un test verifica el `Range` de la descarga: un rango válido devuelve 206 con
  `content-range` y exactamente los bytes pedidos; un rango no satisfacible devuelve 416; sin
  cabecera `Range` devuelve 200 con el archivo completo y su `content-length`.
- **CA-016:** Cada código de error nuevo tiene un test que lo mapea a su status HTTP y verifica que
  su payload no contiene castellano, `.stack` ni ninguna ruta absoluta del host.
- **CA-017:** Una **ejecución real del proceso** (no un test) arranca el servidor contra un
  directorio de medios temporal, crea un proyecto, sube un asset, lee el listado de assets, escribe
  y relee la `Timeline`, descarga un artefacto con y sin `Range`, y termina con exit code 0 ante
  `SIGTERM`. El exit code se observa invocando el proceso, nunca `nx run`.
- **CA-018:** `GET /health` responde `capabilities.assetStore: true` y sigue respondiendo 200 en los
  dos estados (`ok` y `degraded`).
- **CA-019:** Cobertura de `apps/render-api` ≥ 80 % de statements sobre su `src/**`, con el
  `coverage.include` vigente **sin recortar** respecto de `cycle-01`.
- **CA-020:** `apps/render-api/README.md` documenta los endpoints nuevos, las variables de entorno
  nuevas y la decisión D-11 (por qué no hay MinIO hoy y cómo se agregaría detrás del puerto).

### Ciclo 03

- **CA-021:** Un test verifica que crear un job invoca el store para leer `work/timeline.json` del
  proyecto exactamente una vez antes de encolar, y que un `Timeline` ausente o inválida responde con
  el error tipado correspondiente (`TIMELINE_NOT_FOUND` / `TIMELINE_INVALID`) sin crear ningún job,
  verificado sobre el registro de jobs (no por el título del test).
- **CA-022:** Un test verifica que nunca hay dos jobs `running` a la vez: un job creado mientras
  otro está `running` queda `queued`, y pasa a `running` recién cuando el anterior alcanza un
  estado terminal (`succeeded`, `failed` o `canceled`) — verificado sobre el registro de
  transiciones de estado de la cola.
- **CA-023:** Un test verifica que consultar un job en la etapa `render` expone `stage: "render"` y
  un progreso que crece conforme el doble de `renderMutedVideo` invoca su callback `onProgress` con
  valores crecientes de `renderedFrames`, nunca decreciente entre dos consultas sucesivas.
- **CA-024:** Un test verifica que el tipo `RenderMutedVideoPort` acepta un `onProgress` opcional y
  que el adaptador de producción se lo reenvía a `renderTimeline` sin alterar los valores recibidos.
- **CA-025:** Un test verifica que listar los jobs de un proyecto devuelve únicamente los jobs de
  ese slug, en el mismo orden en que fueron creados, y que un proyecto sin jobs devuelve una lista
  vacía.
- **CA-026:** Un test verifica que cancelar un job `queued` lo deja en estado `canceled` sin que se
  haya invocado ningún puerto del pipeline (`renderMutedVideo`, `mixTimelineAudio`,
  `muxAudioIntoVideo`, `verifyMixLoudness`), comprobado sobre el registro de llamadas.
- **CA-027:** Un test verifica que cancelar un job `running` produce un estado terminal distinto de
  `succeeded` y de `failed`, y que cancelar un job ya `succeeded`/`failed`/`canceled` responde 409
  `RENDER_JOB_NOT_CANCELABLE` sin cambiar su estado final.
- **CA-028:** Un test verifica que consultar o cancelar un identificador de job que nunca existió
  responde 404 `RENDER_JOB_NOT_FOUND`.
- **CA-029:** Un test verifica que un job cuyo pipeline lanza en cualquier etapa
  (`prepare`/`render`/`mix`/`mux`/`verify`) queda en estado `failed` con el error tipado completo
  (código, etapa, recurso) embebido en su estado, y que la consulta de ese job sigue respondiendo
  con éxito de transporte.
- **CA-030:** Un test verifica que, tras un job exitoso, el entregable queda en
  `out/<renderId>.mp4` y que `work/renders/<renderId>/video-muted.mp4` y `master.wav` siguen
  existiendo (los intermedios no se borran), igual que D-8 para la llamada directa al pipeline.
- **CA-031:** `GET /health` responde `capabilities.jobQueue` con la capacidad habilitada y sigue
  respondiendo 200 en los dos estados de `status` conocidos (`ok`/`degraded`), sin relación con la
  cola de jobs.
- **CA-032:** Cada código de error nuevo de la cola tiene un test que lo mapea a su status HTTP y
  verifica que su payload no contiene castellano, `.stack`, ni ninguna ruta absoluta del host.
- **CA-033:** Una **ejecución real del proceso** (no un test) arranca el servidor, dispara un job de
  render por HTTP sobre un proyecto real de `media/` con `Timeline` y assets ya presentes, hace
  polling del estado del job hasta observar `succeeded`, descarga el MP4 resultante por el endpoint
  de artefactos existente (`EP-011`), y ejecuta `ffprobe` sobre el archivo descargado comparando la
  duración esperada contra el **stream de video** (`nb_frames` dividido por `r_frame_rate` parseado
  como fracción), **nunca** contra `format.duration`, dentro de la tolerancia que fije el
  architect; el resultado y la salida literal de `ffprobe` quedan guardados en
  `cycles/cycle-03/artifacts/`.
- **CA-034:** `apps/render-api/README.md` documenta los endpoints nuevos de la cola (método, path,
  propósito), la semántica de cancelación por estado, las limitaciones conocidas (concurrencia 1,
  cola en memoria sin persistencia entre reinicios) y referencia el resultado del smoke E2E
  (CA-033).
- **CA-035:** `pnpm nx run-many -t lint test build` termina en verde con `render-api` incluido, y
  `pnpm sdd:validate` en verde, sin dependencias npm nuevas (`package.json` y `pnpm-lock.yaml` sin
  cambios en todo el ciclo).
- **CA-036:** Cobertura de `apps/render-api` ≥ 80 % de statements sobre su `src/**` sostenida,
  incluyendo los archivos nuevos de la cola, con el `coverage.include` vigente **sin recortar**
  respecto de `cycle-02`.
