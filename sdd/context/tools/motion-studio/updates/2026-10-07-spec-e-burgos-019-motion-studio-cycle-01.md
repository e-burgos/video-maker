# spec-e-burgos-019-motion-studio cycle-01 — 2026-10-07

## Estado
Subproyecto nuevo. Cinco comandos (`init`, `voice`, `plan`, `compose`, `render`) con 52 tests y 100 % de
líneas. Primera entrega: presentación de DisplayAds (~87 s, 122 BPM) e instructivos de Counter 15 (~63 s)
y Core Pro (~67 s, 110 BPM), renderizados a 1080p30 con la propia herramienta.

## Estructura
`src/{beats,timeline,voice,template,script,deps,errors}` + `templates/displayads/{_brand,_music,presentacion,counter-15,core-pro}`.
Proyectos de trabajo en `media/motion/<slug>/` (gitignoreado).

## Dependencias
`@video-maker/media-local` (voz sherpa-onnx Piper, whisper-cli, ffmpeg). HyperFrames `0.8.139` por `npx`.
Plugin `hyperframes@hyperframes` habilitado en `.claude/settings.json`.

## Qué sigue
- `wordAt()` de la plantilla estima por posición en el guion cuando Whisper no reconoce la palabra (avisa
  por consola). Si se repite, conviene que `voice` guarde también el alineamiento forzado contra el guion.
- El comando `voice` no corrió en el contenedor del ciclo (sin sherpa-onnx ni whisper-cli para Linux): las
  tomas de esta entrega salieron del mismo modelo Piper vía `piper-tts` con la misma selección por puntaje.
  Correr `voice` en la Mac del dev es la primera verificación pendiente.
- Plantilla 9:16 (reel) a partir de la presentación.
