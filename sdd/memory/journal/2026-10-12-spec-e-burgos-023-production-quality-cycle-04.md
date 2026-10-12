# spec-e-burgos-023-production-quality cycle-04 — 2026-10-12

## Qué pasó
Reinicié el studio para levantar la rama del ciclo mientras la cola de publicación de YouTube tenía una subida en
curso: el intento quedó en TIMEOUT y la cola se detuvo ("STOPPED on unexpected result"). Hubo que verificar en el
canal y en los registros que no se había creado un video a medias antes de relanzarla.

## Lección
Antes de reiniciar el studio, mirar si hay jobs de publicación en curso (`publish-queue.log` y jobs `publish`
activos) y esperar o frenar la cola primero.

## Costo evitable
Una hora de cola parada y una verificación manual del canal.
