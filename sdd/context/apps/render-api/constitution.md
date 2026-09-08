# Constitución — apps/render-api

> Versión 1.0 | Última actualización: spec-e-burgos-005 cycle-01 (apertura) | Fecha: 2026-09-08
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-005-render-service`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.
> **Mientras `cycle-01` esté abierto, este documento declara el diseño previsto, no el estado real.**

## 1. Propósito

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario, sin auth ni despliegue cloud)
- **Rol en el sistema:** expone por HTTP el motor de edición: recibe una `Timeline`, orquesta el
  pipeline completo y devuelve un MP4 masterizado. Es el único subproyecto que puede depender de
  `libs/media-local` y `libs/composition-remotion` a la vez (ver `context_prompt.md`).

## 2. Stack tecnológico previsto

- TypeScript estricto (ESM, Node ≥ 22)
- **Cero dependencias npm nuevas** (D-2 de la spec): servidor sobre `node:http`, argumentos con
  `node:util parseArgs`, filesystem con `node:fs/promises`
- `@video-maker/timeline-core`, `@video-maker/media-local`,
  `@video-maker/composition-remotion/render` (subpath `/render` exclusivamente y sólo vía
  `await import()` dinámico desde el adaptador de producción)
- Vitest sobre toda la lógica no-I/O; los binarios reales sólo en smoke manual, fuera de CI
- Tags Nx: `["scope:engine", "type:app"]`

## 3. Convenciones previstas

- **Una sola frontera de proceso** (`src/main.ts`): el único archivo que toca `process`, `console` y
  las señales del sistema. Todo lo demás devuelve valores.
- **Todo el I/O entra por puertos inyectables**, armados en un único adaptador de producción: la
  suite corre sin ffmpeg, ffprobe, whisper-cli ni Chrome.
- **El orden del pipeline no es conmutable**: `renderTimeline(..., { audio: 'muted' })` → `mixTimelineAudio`
  → `muxAudioIntoVideo` → `verifyMixLoudness`. El render mudo es obligatorio: sin él, el entregable
  sale con el audio de Remotion **encima** de la mezcla masterizada.
- **Todo payload de máquina en inglés** (D-4): `code`, `stage`, `resource`, `expected`, `hint`.
  Ningún payload expone `.stack` ni rutas absolutas del host.
- **Los intermedios se conservan** (D-8): el pipeline crea el workdir y no borra nada.
- **`withinTolerance: false` no es un fallo** (D-7): se publica el entregable y se reporta el delta.
- **`publicDir` = raíz del proyecto de medios, nunca `raw/`** (regla heredada de `tools/render-cli`).
- **`apps/render-api/eslint.config.mjs` no existe** (D-9): el hook `config-protection` del harness
  del dev bloquea cualquier archivo de ese basename. `@nx/eslint:lint` resuelve el flat config de la
  raíz, así que el proyecto sí se lintea y los boundaries se cumplen por el fallback de `type:app`.
  El contenido propuesto vive en el `architect.md` de `cycle-01`.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
