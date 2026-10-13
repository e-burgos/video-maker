# Constitución — libs/motion-graphics

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** lib Node TS (`type:util`)
- **Rol:** todo lo que hace falta para pasar de un storyboard de motion (o una plantilla a mano) a un proyecto de
  HyperFrames listo para renderizar: contrato `MotionStoryboard`, catálogo de escenas, kit de marca, grilla de
  golpes, escenas sobre la grilla, ducking, mejor toma de voz y armado de la plantilla. No ejecuta binarios: eso
  lo hacen sus consumidores (`tools/motion-studio`, `apps/render-api`) con sus puertos.

## 2. Stack

TypeScript estricto, `zod` 4 (contratos), Vitest 4. Runtime de navegador en `assets/runtime/` (GSAP 3.14 local). Sin
`node:*`. Depende de `@video-maker/timeline-core` (alias en `vite.config.ts`); alias `@video-maker/motion-graphics` en
`tsconfig.base.json`, en el vite de `tools/motion-studio` y en el de render-api.

## 3. Reglas

- La IA y las personas describen escenas; el markup y la animación los genera la lib. Nada de HTML en el storyboard.
- Animación declarativa por `data-anim`: el runtime nunca usa `tl.call` para cambiar estado.
- Un storyboard inválido se rechaza con el camino del campo antes de tocar disco.
- Colores, logos y música solo en `assets/brands/<marca>/`; el catálogo es neutral.

## 4. Estructura y contratos

- `src/{beats,timeline,voice,template,script}` (mudados desde la tool), `src/storyboard` (schema + parser con camino del
  campo), `src/brand`, `src/scenes` (helpers, renderers por tipo, sprite de íconos), `src/compose`, `src/auto`,
  `src/pipeline`. `assets/runtime/` (GSAP, `motion-runtime.js` con animador declarativo `data-anim`, `scenes.css` con
  tokens `--mg-*`, sfx), `assets/brands/displayads/`, `assets/storyboards/displayads/` (Core Pro retirado en
  `archivo/`), `assets/briefs/displayads/` (`plataforma-60s`, `plataforma-reel`).
- **Contratos:** `MotionStoryboard` (17 tipos de escena, JSON Schema para la IA) y `BrandManifest`;
  `composeStoryboard` arma `index.html.tpl` + `script.json` sin HTML a mano. La timeline se registra en el HTML
  (`window.__timelines["motion"] = createMotionRuntime(...)`): el lint de HyperFrames lo exige literal.
  `connections.device` exige un equipo de la marca. En 9:16 las escenas se centran en vertical y las mini pantallas de
  `remote-update` llevan el chip debajo. Pantallas de UI (`list`/`status`/`url`) dentro de un equipo van sobre el
  cuadrilátero real (`mg-device-screen` + `matrix()` del polígono y `screen.aspect` del equipo); los títulos no cortan
  palabras con guion (`‑` no separable); `connections` deja las fichas bajo el equipo con la tele ocupando dos filas.
- **Marca (`BrandManifest`)**: `palette` (fondo, acento, acento 2, texto), `tokens` (variables `--mg-*` retocadas),
  `typography`; `css` e `isotipo` opcionales (sin `css` hace falta `palette`); `music` puede estar vacío; por equipo
  `retired`, `plate`, `spokenName`; imágenes `{file, caption}` (`brandImageFile`, `brandImageCaption`,
  `activeDeviceIds`); `fonts[]` con `weight` y `unicodeRange` (`fontFaces` los emite). `deriveBrandTokens` deriva las 35
  variables; `brandCss` = css del archivo o derivado + `tokens` al final; la composición escribe
  `assets/brand/brand.css` generado cuando la marca no tiene css o tiene tokens. Marcas en dos raíces: la del usuario
  primero (`ports.userBrandsRoot`) y las incluidas. Kit DisplayAds: Easy Pro (Core Pro retirado), 19 fotos aprobadas
  con descripción, tagline "Tus pantallas, bajo control.". Fixture `minimalBrand`. `src/brand/{color,derive-brand-tokens,
  brand-css}.ts`.
- **Storyboard automático** (`src/auto/`): `MotionBrief` (`parseMotionBrief`), `buildAutoStoryboardRequest` (prompt desde
  `SCENE_GUIDE` + marca + brief + guion + schema + bloque de límites de assets), `enforceBrief` (marca, formato, golpes,
  título y música del brief ganan; la voz de la respuesta se descarta), `checkStoryboardAgainstBrief` (imágenes,
  equipos, cues, tema), `checkStoryboardBoxes` (rechaza coordenadas que no coinciden con una caja dada),
  `applyBriefBoxes`/`brief-boxes.ts`, `generateMotionStoryboard` (una reparación con los errores, suma de consumo,
  `brand-reveal` anclado al drop). No ofrece `connections` sin equipos ni `gallery` con menos de 2 fotos y pide
  `music: null` si la marca no tiene temas. `accent` es texto que va DESPUÉS del título. El puerto `AskStoryboardAgent`
  es estructural (render-api lo adapta desde su `AiAgentPort`). `fitBeatGrid` lee el tempo de un tren regular de
  onsets por intervalo mediano. `ImageBox` lleva `source: given|measured` con `measuredBy`/`measuredAt`;
  `listMeasuredBoxes(brief)` los lista para que el dueño los confirme. `MotionStudioError` admite `cause`.
- **Pipeline** detrás de `MotionPipelinePorts` (`composeFromStoryboard`, `autoStoryboard`, `voiceProject` con `onLine`,
  `planProject`, `composeProject`, `renderProject`, `initFromTemplate`): lo usan la CLI y el job `motion` de render-api;
  `hyperframesInvocation` arma comando y entorno. `pipeline/sample-composition.ts`: la muestra recorta el
  `data-duration` raíz de `index.html` durante el render y lo restaura (HyperFrames no tiene rango de cuadros y
  rechaza dos composiciones raíz).
- **Dirección y música**: `scenes[].direction` se aplica en el paso voice (re-síntesis si cambia) y el storyboard
  automático la propone; `music.mode`/`floorDb` con `timeline/build-segmented-automation.ts` (`buildSegmentedAutomation`).
- **Escena `ui-walkthrough`**: captura de UI en marco browser/phone/none con hasta 8 pasos (move, click, type,
  highlight, callout, zoom) en coordenadas 0–1 sobre la imagen, anclados a cues de la voz o a `at`; pasos con
  `box: <nombre>` resueltos desde `props.boxes`; `minSec` por escena con o sin golpes. Overlays por porcentaje sobre el
  wrapper de la imagen (vale en 16:9 y 9:16); zoom con scale + xPercent/yPercent que se mantiene hasta el próximo zoom
  o el final de la escena; animaciones de runtime deterministas `ui-*`. La cámara automática contra-escala cursor y
  ancla del globo, y encuadra las franjas anchas y finas desde su inicio (`scenes/ui-auto-zoom.ts`: `isThinStrip`,
  `stripFocus`). La IA la ofrece sólo si el brief trae imágenes.

## 5. Trampas y pendientes vigentes

- Cierre de marca: "Esto es Display Ads." suelto sale mal en ~9 de cada 10 tomas de TTS (Whisper oye "display
  house"); con contexto ("Esto es Display Ads: cartelería digital, …") sale a la primera.
- La IA no ve las imágenes de marca (`brand:escena-04`…): si conviene que las use con criterio, sumar un `caption` por
  imagen al `BrandManifest`.
- El zoom manual todavía no contra-escala globos ni cursor (sólo la cámara automática); zoom exigido en interfaces
  chicas.

## Lecciones específicas

- El storyboard real de un proyecto motion es `motion/storyboard.json`; el de `work/motion/` es una copia vieja.
- Un paso `zoom` manual apaga la cámara automática de `ui-walkthrough`.
