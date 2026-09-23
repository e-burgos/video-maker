# spec-e-burgos-017-desktop-app cycle-02 — 2026-09-23

## Estado
Los cuatro paneles de jobs (render, montaje, storyboard, voz) muestran un badge "Interrumpido" para
un job `failed` con `JOB_INTERRUPTED` y un botón "Volver a intentar" para todo job `failed` o
`canceled`, que llama a `EP-036` y reemplaza el job del panel por el nuevo. Verificado en Chrome real
en inglés y en español (`e2e/interrupted-job-smoke.mjs`).

## Estructura
`retryJob` en el cliente; `JobRetryButton` (COMP nuevo, se oculta solo si el job no es relanzable);
prop `onRetried` en cada panel, cableada al setter de job de cada página; tres códigos nuevos en
`error-explanations.ts` y claves `job.interrupted`/`job.retry` en los dos catálogos.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
El chunk inicial pesa 524 kB y pasa el aviso de 500 kB, pero ya estaba así en `main` por los fixes
de recetas y organización (FIX-e-burgos-015-008..016-001), antes de este ciclo: la interfaz nueva de
`cycle-05` tiene que recuperarlo.
