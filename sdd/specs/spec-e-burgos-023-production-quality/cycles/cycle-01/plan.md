# spec-e-burgos-023-production-quality — cycle-01 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/media-local, libs/timeline-core, apps/render-api, apps/web,
> libs/producer-tools | Fecha: 2026-10-11
> Objetivo: cada render se revisa solo y deja un reporte con hallazgos por severidad; un crítico bloquea la publicación.
> Fuera de alcance: escena de UI (cycle-02), dirección de voz y música por tramos (cycle-03), propuesta (cycle-04),
> video de referencia (cycle-05). Ningún código de OpenMontage (AGPL-3.0).

## Historias
- US-023-101 — Como dev quiero que cada render se revise solo. CA: al terminar un job `render` o `motion` se encola un
  job `review` que deja `out/<render>.review.json` con: máster (integrado ±1 LU de -14 y pico ≤ -1 dBTP), margen
  voz/música bajo la voz por tramo (≥15 dB, medido por pista con las ganancias declaradas), duración del render contra
  la Timeline (±1 cuadro), cuadros negros >1 s y congelados >8 s fuera de los bumpers, silencios de voz >2,5 s,
  subtítulos de una línea y dentro de la zona segura, y recursos faltantes.
- US-023-102 — Como dev quiero declarar qué video prometo. CA: la Timeline acepta `delivery` opcional
  (`kind`: tutorial | motion | short, `requiresVoice`, `requiresCaptions`, `maxDurationSec`, `format`); la revisión
  marca crítico lo que no cumple (p. ej. un short de más de 180 s o un tutorial sin voz). Sin contrato se infiere del
  modo del proyecto y del formato.
- US-023-103 — Como dev quiero hallazgos accionables. CA: cada hallazgo trae `severity`
  (critical/suggestion/nitpick), `check`, mensaje en castellano, tramo opcional y `proposedFix` obligatorio en los
  críticos; el estado global es pass / warn / fail. Publicar un render con críticos responde 409
  `RENDER_REVIEW_FAILED` salvo `ignoreReview: true` explícito.
- US-023-104 — Como dev quiero verlo en el estudio y que el productor lo lea. CA: el proyecto muestra la revisión de
  cada MP4 (estado + hallazgos); el diálogo de publicación avisa y pide confirmar el override; el productor tiene la
  tool `get_render_review`.

## Tasks (detalle en tasks.json)
- TASK-001 — media-local: `measureSegmentLoudness`, `detectBlackSegments`, `detectFrozenSegments`, `detectSilences`
  (ffmpeg, parseo tipado, FixtureCommandRunner en tests).
- TASK-002 — timeline-core: `delivery` en TimelineSchema (+ JSON Schema regenerado) y tipos `ReviewReport` /
  `ReviewFinding`.
- TASK-003 — render-api: reglas puras + recolección de entradas (Timeline de material crudo o timeline motion,
  pistas de voz y música con ganancias, reporte del render).
- TASK-004 — render-api: job `review`, archivo de reporte, disparo automático, `GET /projects/:slug/reviews?file=`,
  precondición de publicación.
- TASK-005 — web + producer-tools: panel Revisión, aviso en publicar, tool `get_render_review`.
- TASK-006 — Verificación con renders reales (tanda Display Ads y el backup motion con la música alta).

## Decisiones técnicas
- Margen voz/música: footage → voz `work/voice/*.wav` (o pista de voz de la Timeline) vs música normalizada a
  `audioMix.music.referenceLufs` con `duckedGainDb` bajo la voz; motion → `vo-*.wav` vs `music.wav` × volumen 0,8 ×
  nivel de la automatización en cada tramo de voz.
- Endpoint nuevo `GET /projects/:slug/reviews` y error `RENDER_REVIEW_FAILED` (409) en publish → api.json.
- Implementación por `sdd-implementor-back` / `sdd-implementor-front` (tier estándar), una task por vez.
