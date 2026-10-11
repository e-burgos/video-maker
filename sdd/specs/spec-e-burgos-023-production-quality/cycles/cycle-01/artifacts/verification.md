# Verificación — spec-e-burgos-023 cycle-01 (2026-10-11)

Studio real (`pnpm studio` con la rama `feat/production-quality-review`), jobs `review` reales sobre `media/`.

| Proyecto | Render | Estado | Hallazgos | Métricas clave |
| --- | --- | --- | --- | --- |
| display-ads-crear-grupo | out/0ebc8623… (aprobado y publicado) | pass | 1 detalle (subtítulo de 0,63 s) | -14,0 LUFS · -1,3 dBTP · margen 18,8 dB |
| display-ads-crear-grupo | out/ef99c609… (render viejo, previo a FIX-010) | **fail** | 1 crítico: máster -18,2 LUFS (desvío -4,2 LU) con arreglo propuesto | -18,2 LUFS · -3,5 dBTP |
| display-ads-estados-campana | out/6dd10be5… | pass | 1 detalle | — |
| display-ads-creacion-campana-full-mobile (9:16) | out/95b836c8… | pass | 2 detalles (subtítulos cortos) | — |
| display-ads-presentacion (motion, FIX-015) | out/video-2026-10-10.mp4 | warn | 2 sugerencias de margen (13,0 y 14,9 dB) | -14,9 LUFS · margen peor 13,0 dB |
| display-ads-ia-promo (motion, FIX-015) | out/video-2026-10-10.mp4 | warn | 1 sugerencia de margen (13,4 dB) | -14,9 LUFS |

- Umbral de margen calibrado con el oído del dueño: la mezcla motion aprobada (peor tramo 13 dB) queda en
  sugerencia; la que tapaba la voz (4,4 dB, test unitario) es crítica. Crítico < 10 dB, sugerencia < 15 dB.
- Modelo de margen en material crudo validado con stems reales (TASK-003): música ±0,1 dB, voz ±0,7 dB.
- Web: panel "Revisión" en Biblioteca › Entregables (`/projects/:slug/library`) y en la vista previa motion; el botón
  "Revisar" encoló el job y mostró el resultado al terminar (captura `panel-revision-con-errores.jpg`).
- Diálogo "Publicar en YouTube" con el render `fail`: alerta con el crítico y "Publicar" deshabilitado hasta tildar
  "Publicar igual (ignorar la revisión)". No se publicó nada.
- Límites declarados: la zona segura de subtítulos se evalúa por el contenedor (no por el texto renderizado); el
  margen motion no contempla whoosh/riser/impacto.
