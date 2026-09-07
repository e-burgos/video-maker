# Constitución — libs/composition-remotion

> Versión 1.0 | Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07
> Creada por el orquestador al abrir `cycle-03` de `spec-e-burgos-001-core-composition-media-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib React 19 + Remotion 4 (browser para Player/Studio; entrada Node separada para render)
- **Rol en el sistema:** materializa una `Timeline` de `@video-maker/timeline-core` en frames:
  pistas de video/imagen/audio, transiciones y captions. Es la única lib que conoce Remotion.

## 2. Stack tecnológico

- React 19, Remotion 4 (`remotion`, `@remotion/transitions`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`) en una única versión exacta
- TypeScript estricto, Vitest + jsdom + `@testing-library/react` para helpers y layout (sin render de video)

## 3. Estructura y patrones

- `src/index.ts` — superficie pública browser-safe (componentes + helpers puros)
- `src/render.ts` — entrada Node (`renderTimeline`) separada del barrel React
- `src/helpers/` — funciones puras: mapeo Timeline → props de Sequence, timings, estilos, layout
- `src/components/` — `TimelineComposition`, `ArollSeries`, `BrollTrack`, `AudioTrack`, `CaptionTrack`
- `src/transitions/` — presentaciones propias (whip-pan) sobre `@remotion/transitions`
- `src/Root.tsx` — composiciones de ejemplo para `remotion studio`
- `src/__fixtures__/` — Timeline de ejemplo construida con `buildTimeline`

## 4. Convenciones propias

- **Render como función**: `Timeline` entra, frames salen; sin estado propio ni I/O en componentes
- **Helpers puros testeables sin montar Remotion**; los componentes se prueban por sus helpers y layout
- **Cero render en CI**: `renderTimeline` y el target `smoke` solo corren manualmente
- **Sin comentarios** en el código; nombres declarativos, componentes cortos
- Tags Nx: `scope:engine`, `type:ui`. Depende solo de `libs/timeline-core`
- Targets explícitos: `lint`, `test` (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json`), `smoke` (manual)
