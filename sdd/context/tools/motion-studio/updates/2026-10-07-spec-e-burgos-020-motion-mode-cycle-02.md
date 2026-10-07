# spec-e-burgos-020-motion-mode cycle-02 — 2026-10-07

## Estado
La lógica pasó a `libs/motion-graphics`. Comando nuevo `storyboard <archivo> <proyecto>` (compone desde el
catálogo, copia runtime, marca, imágenes y música); `init` copia el runtime y la marca de la lib y después
el kit a mano; `plan` acepta `music: null` con una grilla de 120 BPM sin audio; `voice --only id,id` rehace sólo esas líneas
y conserva el resto de `words.json`. Primer uso real de `voice` con Piper/whisper locales: ~30 s por línea
con 5 tomas.

## Estructura
`templates/displayads/` queda con `_brand/brand/` (CSS `--da-*`, `kit.js`, `tutorial.css`) y las tres
plantillas; fuentes/imágenes en `assets/brand/`, GSAP y sfx en `assets/runtime/` dentro del proyecto.

## Dependencias
`@video-maker/motion-graphics`. `MotionDependencies.assetsRoot` (`MOTION_STUDIO_ASSETS`, default
`libs/motion-graphics/assets`).

## Qué sigue
Comando `auto` (cycle-03).
