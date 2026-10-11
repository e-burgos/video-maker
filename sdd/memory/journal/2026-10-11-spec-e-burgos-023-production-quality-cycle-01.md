# spec-e-burgos-023-production-quality cycle-01 — 2026-10-11

## Qué pasó
Un implementador apagó su render-api de prueba con `pkill -f "main.ts"` y el patrón mató también el studio del dev
(mismo comando de arranque). Por suerte la cola de publicación estaba frenada. Además, el primer umbral de margen
voz/música (crítico < 15 dB) marcaba como roto el video motion que el dueño acababa de aprobar de oído.

## Lección
Matar procesos propios sólo por PID guardado al lanzarlos, nunca por patrón; y calibrar todo umbral de calidad contra
un caso aprobado por el dueño y uno rechazado antes de darlo por bueno.

## Costo evitable
Un reinicio del studio y un ciclo extra de calibración del umbral.
