# spec-e-burgos-023-production-quality cycle-01 — 2026-10-11

## Estado
Mediciones para la revisión de renders: `measureSegmentLoudness` (LUFS integrado por tramo, Summary de ebur128),
`detectBlackSegments`, `detectFrozenSegments`, `detectSilences` (blackdetect/freezedetect/silencedetect con parseo
tipado; tramos abiertos se cierran con la duración pasada).

## Estructura
`ffmpeg/measure-segment-loudness.ts`, `ffmpeg/detect-video-defects.ts`, `ffmpeg/detect-silence-segments.ts`,
`ffmpeg/run-ffmpeg-for-stderr.ts`, `ffmpeg/time-segment.ts` (+ specs con salidas reales capturadas).

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
