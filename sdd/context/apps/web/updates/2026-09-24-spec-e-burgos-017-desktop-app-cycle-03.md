# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
Español por defecto (la elección guardada gana; sin elección, `es`, sin mirar `navigator.languages`;
`useT()` sin provider sigue en inglés para los tests). Las carpetas se ven aunque no haya videos, se pueden
renombrar, los modelos del productor se traducen por id y la tabla de jobs muestra "Interrumpido".

## Estructura
`i18n/language.ts` (`DEFAULT_LANGUAGE = 'es'`), `api/producer-model-i18n.ts`, `components/folder-heading.tsx`
con renombrado inline; los textos de voz dicen "motor de voz" en vez de Piper; `VoiceModel.directory` en los tipos.

## Dependencias
Sin dependencias nuevas. Chunk inicial 526,6 kB (sigue arriba del aviso de 500 kB, heredado de main).

## Qué sigue
`cycle-05` rediseña la interfaz centrada en el chat y reemplaza el input de archivos nativo por arrastrar y soltar.
