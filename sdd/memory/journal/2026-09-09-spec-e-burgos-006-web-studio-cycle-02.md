# spec-e-burgos-006-web-studio cycle-02 — 2026-09-09

## Qué pasó

El ciclo tenía un invariante duro —"la salida del render no cambia"— y una pipeline que resultó ser
**byte-determinista**: cuatro jobs previos de `render-api` sobre `media/smoke-ingest` habían dejado
el mismo `sha256` en `video-muted.mp4`. Eso convirtió la no-regresión en un oráculo exacto: correr
un job y comparar el hash, en vez de comparar `nb_frames` (que no distingue un cambio de encuadre).

Lo que le dio valor real al oráculo fue **probar que es sensible**. Al descubrir que el `<Player>`
letterboxea el clip mientras el render llena el cuadro, se probó el arreglo obvio (dar a
`ArollScene` el `{width:'100%',height:'100%',objectFit:'cover'}` que `BrollTrack` ya declara) y el
hash cambió (`c1b9fd9f…` → `2ed415d8…`) — pese a que los píxeles muestreados en tres puntos del
frame eran **idénticos**. Sin el hash, ese cambio se habría dado por inocuo y habría entrado al
ciclo violando el invariante. Se revirtió y se re-verificó con un tercer job.

Aparte, dos hallazgos de herramienta:

1. `@nx/enforce-module-boundaries` **prohíbe mezclar `import` estático y `await import()` de la
   misma lib del workspace** ("Static imports of lazy-loaded libraries are forbidden"). El import
   dinámico puesto para sacar Zod del chunk inicial puso `web:lint` en rojo; la salida no fue
   volver atrás sino mover el único consumidor de `TimelineSchema` a un módulo que sólo alcanza la
   ruta perezosa.

2. La decisión de diseño se tomó leyendo **el código instalado de `remotion@4.0.522`**, no su
   documentación: `OffthreadVideo` ya hace por dentro `isRendering ? OffthreadVideoForRendering :
   VideoForPreview`, y `getRemotionEnvironment().isRendering` se apoya en globals internos
   (`window.process.env.NODE_ENV`, `window.remotion_puppeteerTimeout`). Eso descartó la vía
   "autodetectar el entorno" a favor de un contexto explícito con default `'render'`.

## Lección

Cuando el invariante de un ciclo es "la salida binaria no cambia", usar el hash del artefacto como
oráculo **y validar que el oráculo es sensible** corriendo a propósito un cambio que debería
romperlo: un muestreo de píxeles, un `nb_frames` o una inspección visual dan verde ante cambios
reales.

## Costo evitable

Ninguno grande: los tres renders (~25 s cada uno) fueron el precio de la evidencia, no de un error.
Lo que sí se pagó de más fue ~10 min razonando sobre CSS de Remotion a partir del bundle para
explicar el letterbox, cuando la pregunta decidible era otra —"¿el backend `render` dentro del
Player letterboxea igual?"— y se contesta con una corrida de Playwright de 20 s. Ante "por qué se
ve distinto", medir los dos lados antes de leer el código de la librería.
