# spec-e-burgos-023-production-quality cycle-03 — 2026-10-12

## Estado
`synthesizeSpeech` aplica dirección: lengthScale por ritmo, `--vits-noise-scale`/`--vits-noise-scale-w` por energía (verificados en el binario) y pausa final con `appendTrailingSilence`. Sin dirección la línea de comando es la de siempre.

## Estructura
Nuevo `ffmpeg/append-trailing-silence.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
