# FIX-e-burgos-015-008 — Receta Tutorial Vertical (9:16) para Shorts, Reels y TikTok

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-015-008 · IMPROVEMENT · low · 2026-09-21 · implemented |
| **Spec** | spec-e-burgos-015-studio-producer |
| **Origen** | El dev: "necesito otra receta para videos tutoriales en formato vertical estilo Shorts/Instagram/TikTok, lo mismo que la Receta Tutorial pero para mobile". |

## Problema
La única receta del studio entregaba 16:9. Para mobile no alcanza con cambiar el `format`: **el pipeline no reencuadra**. El A-roll se pasa tal cual al lienzo de salida (`aroll-series.tsx` → `timeline-video.tsx`, y el planner sólo escribe `format` en `resolve-montage-inputs.ts:174`), así que una grabación 16:9 en 1080x1920 sale con barras negras arriba y abajo en el render (`OffthreadVideo` aplica `object-fit: contain`) y **estirada** en el preview (`timeline-video.tsx:12` fuerza `objectFit: 'fill'`).

## Decisión del dev
El A-roll se va a entregar **ya en vertical**, así que no se hace pre-pase de ffmpeg ni se toca el motor. Los subtítulos arrancan en el estilo clásico y se cambian por los grandes desde el selector del preview (`project-preview-page.tsx:224`), funcionalidad que ya existe.

## Solución
- Web: nueva receta `tutorial-vertical` en `PRODUCER_RECIPE_IDS`/`PRODUCER_RECIPES`, su prompt es/en en `producer-recipe-prompts.ts` y sus textos en los dos catálogos i18n. Los chips ya se renderizan desde el array, así que la UI no cambió.
- API: la receta Tutorial del prompt del sistema suma su variante vertical como "la de arriba con tres deltas": `"format":"shorts-9x16"` (`reels-9x16` y `tiktok-9x16` hoy son idénticos — mismas dimensiones y misma safe zone en `format.ts`, y `captionPlatform` no está cableado —, así que no se pregunta la red), verificación con `ffprobe` de que la grabación ya es vertical con freno explícito si no lo es, y logo en `top-left` con `marginRatio: 0.06` porque en 9:16 el ángulo inferior derecho es donde las tres apps apilan sus botones. El `captionStyle` clásico se mantiene y al entregar se avisa que el selector del preview lo cambia.

## Verificación
`pnpm nx run-many -t lint test build -p web render-api` en verde (2026-09-21): web 1010 tests, render-api 1003.
