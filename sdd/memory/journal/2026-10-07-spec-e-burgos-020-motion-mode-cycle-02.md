# spec-e-burgos-020-motion-mode cycle-02 — 2026-10-07

## Qué pasó
Los tests de la lib estaban en verde y el catálogo "andaba", pero la revisión de cuadros a mitad de cada
escena (`hyperframes snapshot --at`) encontró cuatro defectos que ningún test veía: pantallas de UI
dentro del Counter 15 cortadas a la izquierda, fichas de `connections` pisando el pie del capítulo,
"Wi‑Fi" partido en el guion y el cierre "Esto es Display Ads." que Piper/Whisper arruinaba en ~9 de
cada 10 tomas ("display house"). Los dos primeros sólo aparecen con un equipo real de la marca y un
contenido real, no con los fixtures.

## Lección
Antes de cada render, sacar un cuadro a mitad de CADA escena y mirar la hoja de contacto: un catálogo
de escenas se rompe con contenido real (equipos inclinados, textos largos, cuatro fichas) aunque los
tests de markup pasen; y una frase de marca suelta no tiene arreglo por tomas, sólo dándole contexto.

## Costo evitable
Un render de counter-15 y dos rondas de voz del cierre (13 tomas) antes de cambiar la redacción.
