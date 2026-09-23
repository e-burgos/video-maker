# spec-e-burgos-017-desktop-app — cycle-02 · plan (lite)

> Módulo: desktop-app | Subproyectos: libs/local-store (nuevo), apps/render-api, apps/web | Fecha: 2026-09-23
> Flow: **lite** — decisión del dev (perfil `solo`). Un solo actor: escribe este plan, implementa
> task por task (con implementores delegados) y cierra como reviewer.
> Objetivo: que el **estado** del estudio viva en SQLite y sobreviva a un reinicio —proyectos,
> organización, conversaciones del productor, jobs y configuración—, mientras los **medios** y los
> artefactos que el pipeline lee como archivo siguen en disco, sin que cambie ningún contrato HTTP
> existente.
> Fuera de alcance: Electron y la ubicación en la carpeta de datos de la app (`cycle-03`), el índice
> de assets con clasificación (`cycle-05`, ver D-C2-04), migrar `catalog.json`, timeline, EDL,
> storyboard o manifiestos de voz, y persistir la caché de búsqueda de música.

## Estado actual

| Dato | Dónde vive hoy | Problema |
| --- | --- | --- |
| Proyectos | una carpeta por slug en `media/`; el listado es un `listDirectory` | sin metadatos propios (fecha de alta, título) ni consultas |
| Carpetas, categorías, ubicación de cada video | `media/.studio/organization.json`, reescrito entero en cada cambio | escritura no transaccional |
| Conversación y sesión del productor | `work/producer/conversation.json` + `session.json` por proyecto | reescritos enteros en cada mensaje |
| Jobs | `Map` en memoria de `createRenderJobQueue` | **se pierden al reiniciar**: un render en curso desaparece |
| Configuración | variables de entorno | nada persistido que la app pueda cambiar (motor, modelo, trial) |

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C2-01 | **better-sqlite3 + Drizzle ORM**, migraciones propias versionadas por `PRAGMA user_version` (SQL escrito a mano, aplicado en una transacción al abrir) | Sin `drizzle-kit` en runtime: la app empaquetada no puede generar migraciones. Un test asera que el schema de Drizzle y la base migrada coinciden |
| D-C2-02 | Base en `RENDER_API_DB_PATH`, default `<mediaRoot>/.studio/studio.db`, modo WAL y `foreign_keys = ON` | `cycle-03` la apunta a la carpeta de datos de la app sin tocar código |
| D-C2-03 | Un job sin terminar al arrancar pasa a **`failed` con `JOB_INTERRUPTED`**, sin estado nuevo | Sumar un estado a la unión de `RenderJobState` es un cambio global (lección del repo) que rompe la web; `failed` ya lo muestra. Relanzar es un job **nuevo** con los mismos parámetros (`POST /jobs/:jobId/retry`) |
| D-C2-04 | El **índice de assets queda fuera** de este ciclo: la verdad sigue siendo `raw/<rol>/` | El pipeline lee las carpetas; una tabla paralela sin consumidor sería una segunda verdad que se desincroniza. La tabla nace en `cycle-05` con la clasificación asistida, que es quien la necesita |
| D-C2-05 | `conversation.md` y `turns/<turnId>.jsonl` **siguen siendo archivos** | Son export legible y log crudo: no se consultan, se leen enteros |
| D-C2-06 | Importación **al arrancar**, idempotente y de solo lectura sobre `media/`; los archivos viejos no se borran | Un rollback a la versión anterior sigue funcionando con los mismos archivos |
| D-C2-07 | Los tests de `render-api` usan una base **real en memoria** (`:memory:`), no un doble | SQLite en memoria es rápido y prueba el SQL de verdad; los dobles de repositorio esconderían errores de consulta |

## Historias

- **US-017-101 — Base del estudio.** Como dev quiero una base SQLite con migraciones versionadas para
  guardar el estado del estudio. CA: `openStudioDatabase(path)` crea el archivo si falta, activa WAL y
  claves foráneas, aplica las migraciones pendientes en una transacción y deja `user_version` en la
  última; abrir dos veces no vuelve a aplicar nada; una migración que falla deja la base como estaba.
- **US-017-102 — Proyectos y organización en la base.** Como usuario quiero que mis proyectos,
  carpetas y categorías se guarden de forma segura. CA: los endpoints de proyectos, carpetas,
  categorías y ubicación responden **exactamente lo mismo que hoy** (mismos payloads, aserados con
  `Object.keys().sort()`), leyendo y escribiendo en la base; borrar una carpeta desubica sus videos en
  la misma transacción.
- **US-017-103 — Conversación del productor en la base.** Como usuario quiero que la conversación con
  el productor se guarde mensaje a mensaje. CA: `GET …/producer` devuelve la misma forma que hoy;
  cada mensaje se inserta en su propia fila; `session.json` deja de escribirse y la sesión vive en la
  base; `conversation.md` y el log del turno se siguen escribiendo.
- **US-017-104 — Jobs que sobreviven al cierre.** Como usuario quiero que un render en curso no
  desaparezca si se cierra el estudio. CA: todo cambio de estado se escribe en la base y el progreso
  como máximo una vez por segundo por job; al arrancar, todo job `queued`, `running` o `canceling`
  pasa a `failed` con `JOB_INTERRUPTED`; `GET /projects/:slug/jobs` y `GET /jobs/:jobId` lo
  devuelven; `POST /jobs/:jobId/retry` crea un job nuevo con los mismos parámetros y responde `202`;
  la web muestra "interrumpido" con un botón para relanzarlo.
- **US-017-105 — Migración sin pérdida.** Como usuario quiero ver mis proyectos de siempre al
  actualizar. CA: al arrancar, cada carpeta de proyecto de `media/` sin fila en la base se importa,
  junto con `organization.json` y la conversación y sesión de cada proyecto; una segunda corrida no
  duplica nada; los archivos de origen quedan byte a byte iguales (sha256 antes y después).

## Schema (migración 1)

| Tabla | Columnas | Notas |
| --- | --- | --- |
| `projects` | `slug` PK, `created_at`, `updated_at`, `imported_at` nullable | El slug sigue siendo el nombre de la carpeta |
| `folders` | `id` PK, `name`, `position` | |
| `categories` | `id` PK, `folder_id` FK → folders ON DELETE CASCADE, `name`, `position` | |
| `placements` | `slug` PK FK → projects ON DELETE CASCADE, `folder_id` FK ON DELETE SET NULL, `category_id` FK ON DELETE SET NULL, `archived` | |
| `producer_sessions` | `slug` PK FK → projects, `session_id`, `model`, `started_at`, `updated_at` | Reemplaza `session.json` |
| `producer_messages` | `id` PK, `slug` FK → projects, `seq`, `role`, `text`, `suggestions` JSON, `turn_id`, `created_at` | Único `(slug, seq)` |
| `jobs` | `id` PK, `slug` FK → projects, `kind`, `state`, `params` JSON, `progress` JSON, `report` JSON, `error` JSON, `retry_of` nullable, `created_at`, `started_at`, `finished_at` | Índice `(slug, created_at)` |
| `settings` | `key` PK, `value` JSON, `updated_at` | Sin endpoints en este ciclo; lo usan `cycle-03`, `cycle-04` y `cycle-06` |

Las columnas JSON se validan al leer con los mismos parsers que ya usa `render-api` para esos
documentos: la base no es excusa para confiar en lo que devuelve.

## Tasks (detalle en tasks.json)

- **TASK-001** — Scaffold de `libs/local-store` (`scaffold-nx`), dependencias `better-sqlite3`,
  `drizzle-orm` y `@types/better-sqlite3`; `better-sqlite3` va a `onlyBuiltDependencies` de
  `pnpm-workspace.yaml` porque baja su binario nativo en el `postinstall`. Alias en
  `tsconfig.base.json` (archivo protegido: lo aplica el orquestador).
- **TASK-002** — Repositorios con transacciones donde el cambio toca más de una tabla.
- **TASK-003** — Proyectos y organización de `render-api` sobre la base.
- **TASK-004** — Conversación y sesión del productor sobre la base.
- **TASK-005** — Cola de jobs persistente, recuperación al arrancar y `EP-036` `POST /jobs/:jobId/retry`.
- **TASK-006** — Importador al arrancar; `/health` informa la ruta relativa de la base y la versión del schema.
- **TASK-007** — La web muestra `JOB_INTERRUPTED` (código visible más una frase en los dos catálogos
  i18n) y un botón para relanzar.
- **TASK-008** — Verificación real (ver abajo).
- **TASK-009** — Cierre.

## Verificación

- `pnpm nx run-many -t lint test build` en verde en todos los proyectos, cobertura ≥ 80%.
- **Importación real:** una copia de todo `media/` (17 proyectos), sha256 de cada `organization.json`,
  `conversation.json` y `session.json` antes; arrancar dos veces; comparar filas por tabla entre la
  primera y la segunda corrida (tienen que ser iguales) y los sha256 después (sin cambios). El listado
  de proyectos, la organización y la conversación de un proyecto responden lo mismo que en `main`
  sobre la misma copia.
- **Job interrumpido:** encolar un render real sobre una copia, matar el proceso a mitad, arrancar,
  ver el job en `failed`/`JOB_INTERRUPTED`, relanzarlo y verificar el MP4 por el stream de video
  (`nb_frames`).
- **Productor después de reiniciar:** un turno, reinicio del servidor, un segundo turno que retoma la
  sesión (el modelo recuerda el primer mensaje) y la conversación completa en `GET …/producer`.

## Riesgos del ciclo

| Riesgo | Mitigación |
| --- | --- |
| `better-sqlite3` es nativo: el binario para Node 22 puede no bajarse o no compilar | TASK-001 lo instala primero y corre un `SELECT 1` antes de escribir nada más; la recompilación para Electron es de `cycle-03` |
| Escribir el progreso de cada frame en la base frena el render | Progreso con tope de 1 escritura por segundo por job; los cambios de estado se escriben siempre |
| Dos procesos abren la misma base (CLI y API) | WAL más `busy_timeout`; la CLI no abre la base en este ciclo |
| Un endpoint cambia su payload sin querer | Cada handler migrado asera `Object.keys().sort()` contra la forma actual antes y después |
