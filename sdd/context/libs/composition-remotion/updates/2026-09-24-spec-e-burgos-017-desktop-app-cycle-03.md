# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
Se puede renderizar desde un bundle precompilado: con `serveUrl` no se llama a `bundleProject`, y
`browserExecutable` se pasa a `selectComposition`/`renderMedia`.

## Estructura
Target Nx `bundle` (`src/bundle.ts`) que deja el bundle en `dist/libs/composition-remotion/bundle`.
`public/fonts` y `public/example` quedan tapados por el `public` que re-apunta render-api: nada del camino de
render los usa hoy.

## Dependencias
Chrome for Testing headless-shell 149.0.7790.0 (la que espera Remotion 4.0.522), descargado por la app.

## Qué sigue
Nada pendiente para la spec.
