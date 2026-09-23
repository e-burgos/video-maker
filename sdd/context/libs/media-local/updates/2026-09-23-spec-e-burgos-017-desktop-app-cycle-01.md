# spec-e-burgos-017-desktop-app cycle-01 — 2026-09-23

## Estado
Tres wrappers nuevos de ffmpeg para que el productor deje de armar comandos a mano.

## Estructura
- `ffmpeg/extract-frame.ts`: un JPEG con `-ss` antes de `-i`, `-frames:v 1` y escala por lado mayor.
- `ffmpeg/ken-burns-clip.ts`: `buildKenBurnsClip` en FRAMES (el mismo número en `zoompan d=` y en
  `-frames:v`, nunca `-t`), escala previa a 2160x3840.
- `ffmpeg/concat-video-clips.ts`: demuxer concat con `-c copy`.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Nada pendiente en esta lib para la spec.
