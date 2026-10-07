# Constitución — tools/motion-studio

> Versión 1.0 | Última actualización: creación | Fecha: 2026-10-07
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-019-motion-studio`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** tool Node ejecutable (CLI headless) + plantillas HTML versionadas
- **Rol en el sistema:** produce videos de motion graphics (presentaciones, explicativos, instructivos)
  sobre HyperFrames. No monta material grabado: eso es `render-cli`/`render-api` con Remotion.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22), `node:util parseArgs`, Vitest 4 con puertos inyectables.
- `@video-maker/media-local` para la voz (sherpa-onnx Piper) y la transcripción (whisper-cli).
- HyperFrames `0.8.139` vía `npx` (beats, lint, render). **Cero dependencias npm propias.**
- Plantillas: HTML + CSS + GSAP 3.14 local (`assets/vendor`), fuentes locales (Outfit, Geist, Geist Mono).

## 3. Reglas

- Una plantilla registra **una** timeline GSAP pausada en `window.__timelines["<composition-id>"]`.
- Nada de `tl.call` para cambiar texto o estado: capas con fundido (el render busca cuadros salteados).
- Animar transformaciones (`x`, `y`, `scale`), nunca `left`/`top` (el lint lo rechaza).
- La marca vive en `templates/<marca>/_brand/`; un video nunca hardcodea colores fuera de esos tokens.
- Toda música lleva su crédito visible si la licencia lo pide (CC BY).
