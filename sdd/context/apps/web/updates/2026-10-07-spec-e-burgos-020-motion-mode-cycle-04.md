# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
Al crear un proyecto se elige "Motion graphics" o "Material crudo" (radiogroup, default crudo); la
tarjeta muestra la insignia y lleva a `/projects/:slug/motion`. Página Motion: brief (marca, formato,
música, golpes, título, objetivo, público, guion, imágenes de `raw/images` con descripción), "Armar
storyboard" (lista de escenas y costo), "Hacer video" (progreso "Voz 3/7", reproductor del MP4).

## Estructura
`pages/motion-page.tsx`, `components/{motion-brief-form,motion-job-status,motion-scene-list}.tsx`,
`api/{motion-types,motion-brief-form,project-mode,null-when-missing}.ts`; ~40 claves `motion.*` es/en.

## Dependencias
Sin cambios.

## Qué sigue
El texto del uploader de imágenes es el del modo crudo ("emparejan por nombre igual que el B-roll"):
darle copy propio en la página Motion. El reporte de la fase storyboard trae `path`/`durationSec` null.
