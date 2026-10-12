# spec-e-burgos-023-production-quality — cycle-06 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/timeline-core, libs/motion-graphics, libs/producer-tools,
> apps/render-api, apps/web | Fecha: 2026-10-12
> Objetivo: que el productor tenga criterio visual propio. Origen: video de prueba «cómo comprar un equipo de Display
> Ads» (FIX-e-burgos-016..018): eligió fotos de marca sin mirarlas y contra su propia descripción, estimó cajas de
> resaltado que el brief traía medidas, dijo que no había revisión automática sin haberla leído, superó la duración
> prometida sin que nadie lo marcara y los resaltados celestes quedaron estridentes. Ideas tomadas de la revisión de
> OpenMontage (AGPL: sin código): control sin evidencia = crítico, promesa de entrega verificada al final, inventario
> del sujeto de cada escena.

## Historias
- US-023-601 — Como dev quiero que el productor revise el material antes de proponer. CA: `view_images` acepta
  `brand:<clave>` y deja constancia de qué imágenes vio (`work/producer/viewed-images.json`); tool `review_material`
  escribe `work/producer/material-review.json` (`MaterialReview`: por imagen `file`, `source` project|brand, `shows`,
  `useFor`, `verdict` fits|doubtful|unfit, `reason`; `gaps[]` con lo que la idea necesita y el material no trae) y
  rechaza las imágenes que no vio; `propose_production` falla con `MATERIAL_NOT_REVIEWED` si falta la revisión o no
  cubre todas las imágenes del proyecto; la propuesta copia `materialWarnings` (unfit, doubtful y gaps) y el prompt
  obliga a avisarlas arriba de todo y preguntar. `GET /projects/:slug/material-review`.
- US-023-602 — Como dev quiero que las posiciones dadas no se estimen. CA: las imágenes del brief motion aceptan
  `boxes[{name,x,y,w,h}]`; un paso de `ui-walkthrough` puede usar `box: <name>` en lugar de coordenadas; la
  verificación del storyboard (automático y escrito por el productor) rechaza highlight/zoom/type con coordenadas que
  no coinciden con una caja de esa imagen cuando la imagen trae cajas, nombrando la caja más cercana.
- US-023-603 — Como dev quiero una revisión visual con evidencia. CA: el job `review` de un video motion guarda un
  cuadro a mitad de cada escena (`out/<render>.review/scene-NN.jpg`) y deja el hallazgo crítico `visual-not-reviewed`
  hasta que el productor registre con `record_visual_review` por escena `shows`, `matchesVoice`, `legible`,
  `couldBeOtherProduct`, `verdict` (ok|fix) y `note`, sólo sobre cuadros que vio; las escenas `fix` quedan como
  hallazgos críticos; la duración del render se compara con `maxDurationSec` de la propuesta aprobada (crítico si
  excede, sugerencia si queda bajo el mínimo del concepto).
- US-023-604 — Como dev quiero resaltados sobrios y escenas con tiempo. CA: highlight de borde fino, relleno tenue,
  sin brillo fuerte ni anillo oscuro; clic más chico y discreto; `minSec` por escena respetado con o sin cortes al
  golpe.
- US-023-605 — Como dev quiero verlo en el estudio. CA: la tarjeta Propuesta muestra la revisión de material y sus
  avisos; el panel Revisión muestra los cuadros por escena con su veredicto; el chat deja el mensaje en espera con
  aviso si el productor está trabajando y lo envía al terminar el turno.
- US-023-606 — Lecciones. CA: prompt del productor con las reglas aprendidas (mirar antes de elegir, cajas dadas no se
  estiman, no afirmar controles no corridos, preferir la escena product para equipos de la marca, avisar material que
  no encaja); journal del ciclo y memoria.

## Tasks (detalle en tasks.json)
- TASK-001 — material review (timeline-core, render-api, producer-tools).
- TASK-002 — cajas, minSec y resaltados (motion-graphics, timeline-core).
- TASK-003 — revisión visual con evidencia y duración prometida (render-api, producer-tools).
- TASK-004 — web.
- TASK-005 — verificación: rehacer el video de compra sólo con aprobaciones.

## Decisiones técnicas
- TASK-002 · cajas con nombre: el storyboard queda autosuficiente. `ui-walkthrough.props.boxes[{name,x,y,w,h}]` lleva las cajas de
  la captura y cada paso puede usar `box: <name>` en lugar de x/y/w/h (exclusivos). Render y compose sólo leen el storyboard
  (nunca el brief), así que un storyboard escrito por el productor vía `write_motion_storyboard` rinde igual que el automático.
  Resolución en `resolveWalkthroughStep`: highlight/zoom/type cubren la caja; move/click/callout van a su centro; un nombre sin
  caja falla en el render con `STORYBOARD_INVALID`. El brief (`images[].boxes`) es la fuente: `applyBriefBoxes` copia las cajas
  a las escenas que usan `box` (flujo automático y `PUT /motion/storyboard`), y `checkStoryboardBoxes` rechaza coordenadas crudas
  de highlight/zoom/type que no coinciden (±0,01 por lado) con ninguna caja de la imagen nombrando la más cercana, nombres de caja
  inexistentes, y pasos `box` cuando no hay cajas en el brief ni en la escena.
- TASK-002 · `minSec` por escena: campo opcional del storyboard y del script; `layoutScenes` lo garantiza con y sin cortes al
  golpe (con golpes se redondea al próximo beat) y nunca recorta la voz porque entra como un máximo más.
- TASK-002 · resaltados: borde 2 px, relleno 8% del acento, sombra suave; clic de 44 px, borde 2 px, relleno 12%; entrada
  sin rebote (`power2.out`, escala 1,04). Evidencia: `artifacts/highlight-sobrio.jpg`.
