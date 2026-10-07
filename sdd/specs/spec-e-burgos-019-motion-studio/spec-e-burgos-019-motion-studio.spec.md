# SPEC-e-burgos-019: Motion Studio — videos de producto con motion graphics, voz rioplatense y cortes al golpe

> Estado: **completed** — registrada y cerrada el 2026-10-07. Un ciclo `lite` (perfil `solo`).
> Pedido del dev: llevar los videos a "el siguiente nivel" con motion graphics construidos por código
> (skill `heygen-com/hyperframes`), respetando la marca de DisplayAds, con música y la opción de que
> cada corte caiga en un golpe del tema, voz argentina rioplatense, y rehacer la presentación de la
> plataforma y los instructivos de los equipos para comparar antes y después.

## Resumen Ejecutivo

El motor actual (Remotion + mezcla masterizada) monta material grabado: A-roll, B-roll, subtítulos,
logo y música. No sabe **diseñar** una escena: títulos cinéticos, maquetas de producto animadas,
diagramas de conexión, contadores, interfaces simuladas. La presentación institucional de DisplayAds
hoy es un video de NotebookLM de 8 min a 720p, con paleta rosa/violeta fuera de marca y marca de agua.

Esta spec suma `tools/motion-studio`: una herramienta que arma videos de motion graphics sobre
**HyperFrames** (HTML + GSAP renderizado cuadro a cuadro a MP4, Apache 2.0, sin costo por render), con
plantillas de marca versionadas, voz generada con la mejor toma, grilla de golpes de la música y
mezcla con ducking.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Plantillas de marca reutilizables (tokens, tipografías, componentes) y tres videos de DisplayAds: presentación de la plataforma, instructivo Counter 15 e instructivo Core Pro | cycle-01 |
| O-2 | Cortes al golpe opcionales: grilla regular ajustada sobre los golpes que detecta `hyperframes beats`, escenas que arrancan en un golpe (con anclas a compases fuertes) y un modo libre con `--no-beat-sync` | cycle-01 |
| O-3 | Voz es_AR con selección de la mejor toma: N tomas por frase, transcripción y puntaje de inteligibilidad contra el guion; tiempos por palabra para sincronizar la animación | cycle-01 |
| O-4 | Las skills de HyperFrames disponibles para cualquier sesión de Claude Code en el repo | cycle-01 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | HyperFrames convive con Remotion, no lo reemplaza: Motion Studio produce MP4 completos o piezas que después se montan | Remotion ya resuelve el montaje de material grabado y su mezcla está verificada |
| D-02 | Las plantillas viven en `tools/motion-studio/templates/<marca>/<video>/` (`index.html.tpl` + `script.json` + `assets/`) y la marca en `templates/<marca>/_brand/` | Una plantilla es código revisable y diffeable; la marca se cambia en un solo lugar |
| D-03 | Voz: el stack existente (Piper `es_AR-daniela-high` vía sherpa-onnx de `media-local`) con mejor toma de N por transcripción | Piper es estocástico: la misma frase sale distinta en cada corrida y algunas tomas se traban; medir con Whisper elige la que se entiende |
| D-04 | Música CC BY 4.0 (Kevin MacLeod, incompetech.com) con el crédito visible en el video | El catálogo de HeyGen pide cuenta; CC BY permite uso comercial con crédito |
| D-05 | La grilla de golpes se ajusta sobre los onsets de `hyperframes beats` (período + fase por puntaje de fuerza) | `hyperframes beats` devuelve golpes sueltos e irregulares; cortar en tiempo necesita el pulso parejo |
| D-06 | Cero dependencias npm propias: HyperFrames se invoca con `npx hyperframes@0.8.139` (versión fijada) | Misma regla que `render-cli`; la versión fija hace el render reproducible |
| D-07 | Las HyperFrames skills se habilitan como plugin del repo (`.claude/settings.json`) en vez de copiarse | Son 22 skills y 29 MB que se actualizan solas desde su marketplace |
| D-08 | After Effects queda fuera: se documenta el puente Lottie (exportar de AE y reproducir en HyperFrames) | Los MCP de After Effects necesitan AE abierto con licencia en macOS/Windows y no son reproducibles |
