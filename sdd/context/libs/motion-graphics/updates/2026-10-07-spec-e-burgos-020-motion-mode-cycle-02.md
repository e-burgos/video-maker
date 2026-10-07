# spec-e-burgos-020-motion-mode cycle-02 — 2026-10-07

## Estado
Lib nueva con 83 tests al cierre del ciclo. Contratos `MotionStoryboard` (16 tipos de escena,
JSON Schema para la IA) y `BrandManifest`; `composeStoryboard` arma `index.html.tpl` + `script.json` sin
HTML a mano. Los tres videos de la spec-019 re-expresados como storyboards y renderizados (counter-15 70,4 s,
core-pro 77,0 s, presentación). La revisión de cuadros del cierre corrigió tres defectos del productor:
pantallas de UI (`list`/`status`/`url`) dentro de un equipo van sobre el cuadrilátero real de la pantalla
(`mg-device-screen` + `matrix()` calculada del polígono y `screen.aspect` del equipo, nuevo campo opcional
del `BrandManifest`), los títulos no cortan palabras con guion (`‑` no separable) y `connections` deja las
fichas bajo el equipo con la tele ocupando las dos filas (antes pisaban el pie del capítulo).

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
- Cierre de marca: "Esto es Display Ads." suelto sale mal en ~9 de cada 10 tomas de Piper (Whisper oye
  "display house"); con contexto ("Esto es Display Ads: cartelería digital, …") sale a la primera.
- La timeline se registra en el HTML (`window.__timelines["motion"] = createMotionRuntime(...)`): el lint
  de HyperFrames lo exige literal, no le alcanza con que lo haga el runtime.
- Verificación visual 9:16 (cycle-04). `connections.device` exige un equipo de la marca.
