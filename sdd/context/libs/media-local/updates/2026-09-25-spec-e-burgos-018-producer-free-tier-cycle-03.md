# spec-e-burgos-018-producer-free-tier cycle-03 — 2026-09-25

## Estado
Nueva función `resizeImage` para achicar fotos a JPEG.

## Estructura
`src/ffmpeg/resize-image.ts`: misma invocación que la extracción de frame pero sin `-ss` (con `-ss`, sobre una
imagen fija ffmpeg sale 0 sin escribir el archivo).

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
