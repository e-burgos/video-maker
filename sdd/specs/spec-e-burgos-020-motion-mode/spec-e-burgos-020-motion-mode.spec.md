# SPEC-e-burgos-020: Modo motion graphics — un guion e imágenes, y el Video Maker hace el resto

> Estado: **in-progress** — registrada el 2026-10-07. Continúa `spec-e-burgos-019-motion-studio`.
> Pedido del dev: unificar en el Video Maker los videos animados (el `apps/video-manager` de display-ads y
> Motion Studio) sin perder nada, y que el estudio ofrezca de entrada dos caminos: **video con motion
> graphics** (alcanza con un buen guion e imágenes; el resto lo hace el Video Maker) o **video con material
> crudo** (el pipeline actual).

## Resumen Ejecutivo

Hoy hay dos motores de video animado separados:

- `display-ads/apps/video-manager`: motor React por timeline, editor visual con retiming y export desde el
  navegador; tres videos ("Cómo funciona", conexión Core Pro, conexión Mostrador); **sin audio**.
- `video-maker/tools/motion-studio` (spec-019): HyperFrames, voz es_AR con mejor toma, música con cortes al
  golpe, render headless; **plantillas escritas a mano por video** y solo por CLI.

Ninguno arma un video solo a partir de un guion: alguien escribe cada escena. Esta spec junta los dos en el
Video Maker y agrega el paso que faltaba: un catálogo de escenas parametrizables y un storyboard que la IA
completa a partir del guion y las imágenes.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | `video-manager` vive en el Video Maker como `apps/motion-editor`, con su editor, motor, tres videos, tests y guías intactos | cycle-01 |
| O-2 | `libs/motion-graphics`: la lógica de Motion Studio como lib + catálogo de escenas parametrizables + contrato `MotionStoryboard`; los tres videos de la spec-019 re-expresados como storyboards | cycle-02 |
| O-3 | Storyboard automático: guion + imágenes + marca → `MotionStoryboard` validado, con el motor del productor (Claude CLI u OpenRouter) | cycle-03 |
| O-4 | El estudio ofrece de entrada "motion graphics" o "material crudo"; job `motion` en render-api; recipe y tool del productor; corre en la app de escritorio | cycle-04 |
| O-5 | display-ads entrega a video-maker los dos tipos de pedido por un único contrato: video de **motion graphics** (`MotionBrief`: guion + imágenes descriptas + marca) o **tutorial grabado** (material crudo de `platform-video-capture`). La skill `video-maker-material-contract` cubre ambos modos; una skill de display-ads decide el modo por video desde su índice de tutoriales y arma el paquete; se retira `apps/video-manager` | cycle-05 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | El motor por defecto del modo motion es HyperFrames (render headless con audio); el motor React de `motion-editor` se conserva para edición visual manual | Solo HyperFrames resuelve audio, golpes y render sin navegador abierto; el editor visual no tiene reemplazo todavía |
| D-02 | La IA no escribe HTML: elige escenas del catálogo y completa sus campos (`MotionStoryboard`) | Un JSON validado por schema es confiable con cualquier modelo (incluso OpenRouter barato); las plantillas a mano siguen disponibles para piezas especiales |
| D-03 | La marca es un kit (`brands/<marca>/`: tokens, fuentes, logos, música) separado del catálogo de escenas | El mismo catálogo sirve a cualquier cliente |
| D-04 | El catálogo sale de las escenas ya validadas en los videos de la spec-019 y de `video-manager` | No se inventa diseño nuevo: se generaliza el que ya funcionó |
| D-05 | Se mantiene el flujo SDD por ciclo; los ciclos que crean contratos consumidos por otro subproyecto (02, 04) van con flow `full` | Regla del kit: contrato compartido → full |
