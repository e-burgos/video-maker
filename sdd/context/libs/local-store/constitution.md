# Constitución — libs/local-store

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** lib TypeScript (Node, módulo nativo)
- **Rol en el sistema:** base SQLite del estudio: apertura con WAL y claves foráneas, migraciones
  versionadas por `user_version`, schema Drizzle y repositorios de proyectos, organización,
  conversaciones del productor, jobs y configuración. La consume `apps/render-api`.

## 2. Stack tecnológico

- `better-sqlite3` 13.0.3 (sincrónico, nativo; binario precompilado darwin-arm64 en `onlyBuiltDependencies`, recompilado para el
  Node de Electron con `@electron/rebuild`), `drizzle-orm` 0.45.3, `@types/better-sqlite3`, Zod para validar columnas JSON, Vitest.

## 3. Estructura y patrones

- `database/` abre la base y aplica migraciones escritas a mano (sin `drizzle-kit` en runtime).
- `schema/` es el schema Drizzle; un test asera que coincide con la base migrada.
- `repositories/` expone funciones por agregado; lo que toca más de una tabla va en una transacción.
- Migraciones vigentes: 1 (8 tablas base; `producer_messages` con columna `model`; el único `(slug, seq)` es un índice
  con nombre para que el test de drift lo reconozca) · 2 `producer_messages.usage` (JSON nulable, tokens y costo;
  `ProducerMessageUsage` en `producer-repository.ts`) · 3 tabla `assets` (ruta, rol propuesto con razón, rol
  confirmado, estado pending/confirmed, probe; `assets-repository.ts`: `insertPending`, `listPending`, `get`,
  `confirm`, `delete`) · 4 `projects.mode TEXT NOT NULL DEFAULT 'footage'` (`schema/project-mode.ts` —fuera de
  `studio-schema.ts` porque el test de migraciones itera sus valores como tablas—; `insert(slug, importedAt?, mode =
  'footage')`) · 5 `projects.brand TEXT NULL` (`insert(slug, importedAt, mode, brand)`, `setBrand(slug, brand|null)`;
  borrar una marca no toca los proyectos que la usan) · 6 tabla `publications` (proyecto, plataforma, archivo, título,
  videoId, url, privacidad, estado uploading|published|scheduled|failed, programada, publicada, job;
  `publications-repository.ts`, `countCreatedSince` para el límite diario) · 7 tabla `publish_queue` (slug, file,
  metadata JSON, position, status queued|publishing|published|already-published|failed, attempts, last_error,
  next_attempt_at, job_id, url; `publish-queue-repository.ts`).
- `JobsRepository.listSucceededByKinds` alimenta el estimador de la propuesta.

## 4. Convenciones propias

- Nunca guardar medios binarios en la base: solo estado, metadatos y rutas relativas al proyecto.
- Toda columna JSON se valida al leer.
- La lib no importa `apps/*`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
