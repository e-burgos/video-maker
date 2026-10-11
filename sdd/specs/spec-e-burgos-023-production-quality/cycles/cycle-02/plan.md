# spec-e-burgos-023-production-quality — cycle-02 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/motion-graphics, tools/motion-studio, apps/render-api | Fecha: 2026-10-11
> Objetivo: una escena motion que explica una interfaz real con cursor, clics, tipeo, resaltados, globos y zoom.
> Fuera de alcance: grabación de pantalla (eso es material crudo); dirección de voz (cycle-03). Sin código de OpenMontage.

## Historias
- US-023-201 — Como dev quiero explicar una pantalla de la plataforma en un video motion. CA: la escena `ui-walkthrough`
  muestra una captura (imagen del proyecto o de marca) dentro de un marco browser/phone/none y ejecuta hasta 8 pasos:
  `move` (el cursor viaja a x,y), `click` (pulso), `type` (texto que se escribe en una caja a x,y,w,h), `highlight`
  (recuadro que se enciende sobre x,y,w,h), `callout` (globo con texto anclado a x,y) y `zoom` (acerca la región y
  vuelve). Coordenadas normalizadas 0–1 sobre la captura; cada paso puede anclarse a una palabra de la voz (`cue`).
  Animación declarativa y determinista (sin `tl.call`, sólo x/y/scale/opacity), legible en 16:9 y 9:16.
- US-023-202 — Como dev quiero que el storyboard automático la use bien. CA: la guía de escenas la describe para la IA;
  la verificación cruzada rechaza imágenes inexistentes, coordenadas fuera de 0–1, cajas de tamaño 0 y cues que la voz
  no dice, nombrando escena y campo.

## Tasks (detalle en tasks.json)
- TASK-001 — schema + renderer HTML de la escena.
- TASK-002 — runtime (cursor, clic, tipeo, resaltado, globo, zoom) + CSS.
- TASK-003 — guía para la IA + verificación cruzada.
- TASK-004 — render real con una captura de Display Ads, cuadros revisados y review sin críticos.

## Decisiones técnicas
- La escena reutiliza el sistema de cues y `animAttrs` existente; nuevos tipos de animación en `motion-runtime.js`
  con estado calculable por tiempo (render en paralelo por cuadros).
- Cursor e íconos propios en SVG inline (sin assets externos).
