# spec-e-burgos-022 cycle-02 — 2026-10-13

## Estado
Migración v7: tabla `publish_queue` (slug, file, metadata JSON, position, status queued|publishing|published|already-published|failed, attempts, last_error, next_attempt_at, job_id, url). `publications.countCreatedSince` para el límite diario.

## Estructura
Nuevo `src/repositories/publish-queue-repository.ts` (+ spec).

## Dependencias
Sin cambios.

## Qué sigue
Nada.
