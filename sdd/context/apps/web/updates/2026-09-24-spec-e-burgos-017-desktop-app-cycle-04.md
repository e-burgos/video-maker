# spec-e-burgos-017-desktop-app cycle-04 — 2026-09-24

## Estado
Página `/settings` (perezosa): motor del productor, key de OpenRouter de solo escritura con hint, catálogo
completo con búsqueda y recomendados con métricas; el chat muestra el motor activo, solo los modelos
recomendados y el costo de cada turno (`message.usage.costUsd`, formateado por idioma).

## Estructura
`pages/settings-page.tsx`, `components/openrouter-model-picker.tsx`, `api/parse-producer-settings.ts`,
`api/producer-engine-i18n.ts`, `api/producer-cost-format.ts`. En `producer-page.tsx` el modelo elegido se
resetea si deja de estar entre las opciones (carrera entre la conversación y la configuración).

## Dependencias
Sin dependencias nuevas. Chunk inicial 533,9 kB.

## Qué sigue
`cycle-05` rediseña la interfaz y tiene que bajar el chunk inicial.
