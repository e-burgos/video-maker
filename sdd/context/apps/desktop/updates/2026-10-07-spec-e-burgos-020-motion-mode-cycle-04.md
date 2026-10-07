# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
render-api empaquetado con `hyperframes@0.8.139` en sus deps de runtime y `libs/motion-graphics/assets`
como `motion-assets`; `MOTION_GRAPHICS_ASSETS`, `HYPERFRAMES_RESOLVE_FROM` y el ffmpeg propio primero
en `PATH` (HyperFrames lo busca por PATH).

## Estructura
`scripts/build-desktop.mjs`, `electron-builder.yml`, `src/main/render-api-env.ts`.

## Dependencias
`hyperframes@0.8.139` (y sus nativos `sharp`, `onnxruntime-node`) dentro de `resources/render-api/node_modules`.

## Qué sigue
Probar un video motion con la app instalada (dmg nuevo) antes de publicar la próxima versión.
