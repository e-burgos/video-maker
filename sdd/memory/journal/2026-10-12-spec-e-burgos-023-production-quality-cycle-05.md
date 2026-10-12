# spec-e-burgos-023-production-quality cycle-05 — 2026-10-12

## Qué pasó
El detector de escenas con umbral fijo 0,3 pasó los tests y el smoke con cortes secos sintéticos, pero en el navegador
la presentación motion (11 escenas con transiciones suaves) salió como una sola escena. Hubo que rehacerlo con puntajes
muestreados y umbral adaptativo.

## Lección
Todo detector o medición se valida contra un video real del tipo que produce el estudio (motion con transiciones,
tutorial grabado), no sólo contra un caso sintético hecho para que pase.

## Costo evitable
Una reescritura del detector y un reinicio extra del studio.
