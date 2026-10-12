# Verificación — spec-e-burgos-023 cycle-04 (2026-10-12)

## Propuesta y aprobación (studio real, rama feat/production-quality-proposal)
- `PUT /projects/cafe-aroma-demo/proposal` con dos conceptos (motion 16:9 de 45 s y reel 9:16). El `GET` los devuelve
  recalculados con el historial real: promo-desayuno 6,2 min de render (5 jobs motion de referencia), reel-cafe 1 min
  (7 jobs de reels); motor claude-cli → `usd: null`.
- Web: tarjeta "Propuesta" en el panel del productor; "Aprobar este enfoque: Promo de desayuno con IA" deja
  `status: approved` y el encabezado muestra "Propuesta aprobada" (`web-propuesta-aprobada.jpg`).
- Productor: `start_job` render/motion completo sin propuesta aprobada → `PROPOSAL_NOT_APPROVED` con hint;
  `sample` nunca se bloquea y `skipProposal: true` lo saltea (tests de handlers + MCP).

## Muestras
- Motion (`cafe-aroma-demo`, Vista previa → "Generar muestra (10 s)"): `out/video.sample.mp4`, 10 s, 1920×1080,
  `readyState` 4 en el navegador (`sample-motion-presentacion-frame-6s.jpg`).
- Material crudo (`cafe-aroma-crudo`, mismo botón): `out/106baa72-….sample.mp4`, 300 cuadros, 10 s, 1080×1920,
  `readyState` 4 (`web-muestra-footage.jpg`, `sample-footage-crear-grupo-frame-5s.jpg`).
- Las muestras no disparan revisión, no aparecen en Entregas ni en publicar (tests de `publish-preconditions` y
  `workspace-panel`).
