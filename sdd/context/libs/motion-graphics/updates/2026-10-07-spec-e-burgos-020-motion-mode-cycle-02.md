# spec-e-burgos-020-motion-mode cycle-02 — 2026-10-07

## Estado
Lib nueva con 80 tests (99 % de líneas, 92 % de ramas). Contratos `MotionStoryboard` (16 tipos de escena,
JSON Schema para la IA) y `BrandManifest`; `composeStoryboard` arma `index.html.tpl` + `script.json` sin
HTML a mano. Los tres videos de la spec-019 re-expresados como storyboards y renderizados.

## Estructura
`src/{beats,timeline,voice,template,script}` (mudados desde la tool), `src/storyboard` (schema + parser con
camino del campo), `src/brand`, `src/scenes` (helpers, renderers por tipo, sprite de íconos), `src/compose`.
`assets/runtime/` (GSAP, `motion-runtime.js` con animador declarativo `data-anim`, `scenes.css` con tokens
`--mg-*`, sfx), `assets/brands/displayads/` (`brand.json`, `brand.css`, fuentes, logos, imágenes, música) y
`assets/storyboards/displayads/{presentacion,counter-15,core-pro}.json`.

## Dependencias
Sólo `zod` (raíz). Alias `@video-maker/motion-graphics` en `tsconfig.base.json` y en el vite de
`tools/motion-studio`; render-api va a necesitar el suyo en cycle-04.

## Qué sigue
- La timeline se registra en el HTML (`window.__timelines["motion"] = createMotionRuntime(...)`): el lint
  de HyperFrames lo exige literal, no le alcanza con que lo haga el runtime.
- Verificación visual 9:16 (cycle-04). `connections.device` exige un equipo de la marca.
