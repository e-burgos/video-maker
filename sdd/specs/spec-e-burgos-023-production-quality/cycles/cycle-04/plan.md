# spec-e-burgos-023-production-quality — cycle-04 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/producer-tools, apps/render-api, libs/composition-remotion,
> apps/web | Fecha: 2026-10-12
> Objetivo: el productor propone antes de producir (2–3 enfoques con costo y tiempo), el dev aprueba, y se ve una
> muestra corta antes del render completo. Sin código de OpenMontage.

## Historias
- US-023-401 — Como dev quiero que el productor me proponga enfoques. CA: tool `propose_production` escribe
  `work/producer/proposal.json` con 2–3 conceptos `{id, title, angle, format (preset), durationSec, scenes, delivery,
  voiceId, musicMode, estimate}` y un `recommendedId`; el prompt lo obliga a proponer antes del primer render completo.
- US-023-402 — Como dev quiero ver costo y tiempo antes de producir. CA: `estimate = { renderMinutes, voiceMinutes,
  producerTokens?, usd? }` calculado con el historial real de jobs del estudio (segundos de proceso por segundo de
  video, por modo y formato) y la tarifa del motor del productor si es pago (OpenRouter); suscripción → sin USD.
  `GET /projects/:slug/proposal` lo devuelve recalculado.
- US-023-403 — Como dev quiero que nada se renderice completo sin mi aprobación. CA: `POST /projects/:slug/proposal/approve
  {conceptId}` marca aprobado; `start_job` del productor para render/motion completo sin propuesta aprobada responde
  `PROPOSAL_NOT_APPROVED` con hint; el dev desde la web puede renderizar igual (no bloquea la UI humana).
- US-023-404 — Como dev quiero una muestra antes del render completo. CA: render con `sample: { seconds: 8–20 }` para
  material crudo (rango de cuadros de Remotion) y motion (rango de HyperFrames si lo soporta; si no, recorte del
  render con ffmpeg documentado); queda como `out/<id>.sample.mp4`, se marca muestra y no se ofrece para publicar.

## Tasks (detalle en tasks.json)
- TASK-001 — modelo, estimador y endpoints. TASK-002 — productor y bloqueo. TASK-003 — muestra.
- TASK-004 — web. TASK-005 — verificación.

## Decisiones técnicas
- La propuesta es un documento del proyecto (como el guion), no una tabla.
- El bloqueo vive en la tool del productor (el humano siempre puede renderizar desde la UI).

## Pendiente de documentar en contexto
- timeline-core: `ProductionProposal`/`ProductionProposalDraftSchema` (`proposal/production-proposal.ts`); el documento vive en `work/producer/proposal.json` y solo lo escriben los endpoints `/projects/:slug/proposal` (el texto del productor lo rechaza con PATH_NOT_WRITABLE).
- render-api: `proposal/` (estimador `estimateProduction` sobre `JobsRepository.listSucceededByKinds`), jobs `render`/`motion` con `sample {seconds 8-20}`, salida `*.sample.mp4`, reporte `sample: true`, sin job de revisión y excluida de publicar y de la vista motion.
- motion-graphics: la muestra recorta el `data-duration` raíz de `index.html` durante el render y lo restaura (HyperFrames no tiene rango de cuadros y rechaza dos composiciones raíz).
- producer-tools: tool `propose_production`, error `PROPOSAL_NOT_APPROVED` y bloqueo de `start_job` render/motion completo sin propuesta aprobada (`skipProposal: true` solo a pedido explícito del dev; `sample` nunca se bloquea).
- web: tarjeta `Propuesta` (`proposal-card.tsx`) dentro del panel del productor, estado en el encabezado (`proposal-status-badge.tsx`), `SampleTrigger` (render y motion) y etiqueta `Muestra` en la Biblioteca; `useProducerConversation` expone `proposal` (se recarga con los eventos del turno); Entregas/Vista previa del panel lateral filtran los renders sin `out/<id>.mp4` (las muestras).
