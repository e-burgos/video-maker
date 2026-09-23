# spec-e-burgos-017-desktop-app cycle-02 — 2026-09-23

## Estado
El estado del servicio vive en SQLite (`libs/local-store`, `RENDER_API_DB_PATH`, default
`<mediaRoot>/.studio/studio.db`): proyectos, organización, conversación y sesión del productor, jobs y
configuración. Los payloads de todos los endpoints existentes no cambiaron. Los jobs sobreviven al
reinicio: al arrancar, todo job sin terminar pasa a `failed` con `JOB_INTERRUPTED` y `EP-036`
`POST /jobs/:jobId/retry` crea uno nuevo con los mismos parámetros (`retry_of`). Al arrancar se
importa, de solo lectura e idempotente, lo que había en `media/`.

## Estructura
- `deps.localStore` (puerto `LocalStorePort`, abierto perezoso en el adaptador Node y cerrado al cerrar
  el servidor); los tests usan una base real `:memory:`.
- `jobs/job-persistence.ts` (params por kind, snapshot de la timeline del render, validación al leer:
  una fila corrupta sale como `failed`/`JOB_RECORD_INVALID`); la cola escribe cada transición y el
  progreso con tope de una escritura por segundo; `recoverInterruptedJobs` al crear el runtime.
- `store/import-legacy-media.ts` (proyectos en cada arranque, organización una vez con marca y sha256
  en `settings`, conversación si el proyecto no tiene mensajes) y `resolveExistingProject` inserta la
  fila de una carpeta de proyecto que aparece con el servicio corriendo.
- `/health` gana `store: { schemaVersion, dbPath }`. Códigos nuevos `JOB_INTERRUPTED`,
  `JOB_RECORD_INVALID`, `JOB_NOT_RETRYABLE`. Puerto nuevo `hashText`.
- Ya no se escriben `organization.json`, `conversation.json` ni `session.json`; `conversation.md` y
  `turns/<turnId>.jsonl` siguen siendo archivos.

## Dependencias
`@video-maker/local-store` (better-sqlite3 13 + drizzle-orm 0.45).

## Qué sigue
Un `kill -9` deja vivos los `chrome-headless-shell` de Remotion: `cycle-03` (Electron) tiene que
matar el árbol de procesos de `render-api` al cerrar. La caché de búsqueda de música sigue en memoria.
