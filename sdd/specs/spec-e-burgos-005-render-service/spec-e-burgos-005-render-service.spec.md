# SPEC-e-burgos-005: Local Render Service & Asset Storage

> Estado: **in-progress** — detallada por el sdd-orchestrator al abrir `cycle-01` (2026-09-08).

## Resumen Ejecutivo

Servicio local Node (`apps/render-api`) que expone una API REST para gestionar assets crudos en MinIO (docker-compose del repo), encolar jobs de render headless (Remotion + FFmpeg) con progreso y cancelación, y persistir timelines/EDL generadas. Corre en la máquina del dev; no tiene autenticación multiusuario ni despliegue cloud en su alcance inicial.

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

## Plan de ciclos

| Ciclo | Fase | Qué entrega | Estado |
| --- | --- | --- | --- |
| **cycle-01** | `render-service-foundation` | La app `apps/render-api` existente y ejecutable; puertos inyectables; la orquestación `render → mix → mux → verify` en una sola llamada; la superficie de errores tipada en inglés con su mapeo a HTTP; servidor `node:http` con `GET /health`. Sin cola, sin MinIO, sin endpoints de assets. | en curso |
| **cycle-02** | `asset-store-and-project-persistence` | Store de assets sobre `media/` (D-3): listar proyectos y assets, subir un asset, sondearlo con `probeMedia`; persistencia de `Timeline`/`EditDecisionList` como JSON en `work/`; la vista MinIO sobre el store canónico (o su descope explícito con fundamento). | pendiente |
| **cycle-03** | `render-job-queue-and-delivery` | Cola en proceso con concurrencia 1; `POST /jobs`, `GET /jobs/:id`, `DELETE /jobs/:id`; progreso por etapa y por frame; **smoke real E2E obligatorio** (job disparado por HTTP que termina en un MP4 verificado con `ffprobe` contra el stream de video); `FIX-e-burgos-001-001` → `validated`; los `[IMPROVEMENT]` de D-5 y D-6; cierre de la spec. | pendiente |

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

### Ciclo 02 y 03

Se detallan al abrir cada ciclo, sobre el plan de la tabla anterior.

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
