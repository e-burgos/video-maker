# Constitución — libs/composition-remotion

> Versión 1.0 | Última actualización: cycle-02 (spec-e-burgos-003) + FIX-e-burgos-001-001 | Fecha: 2026-09-08
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib React 19 + Remotion 4 (browser para Player/Studio; entrada Node separada para render)
- **Rol en el sistema:** materializa una `Timeline` de `@video-maker/timeline-core` en frames:
  pistas de video/imagen/audio, transiciones y kinetic captions. Es la única lib que conoce Remotion.

## 2. Stack tecnológico

- React 19, Remotion 4.0.522 en versión exacta única (`remotion`, `@remotion/transitions`,
  `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`)
- TypeScript estricto, Vitest 4 + jsdom + `@testing-library/react` para helpers y layout (sin render de video)

## 3. Estructura y patrones

- **Dos entry points, dos alias en `tsconfig.base.json`:** `@video-maker/composition-remotion` →
  `src/index.ts` (barrel browser-safe) y `@video-maker/composition-remotion/render` → `src/render.ts`
  (Node puro). `registerRoot` vive **solo** en `src/remotion-entry.ts`. `Root.tsx`, `remotion-entry.ts`,
  `smoke.ts`, `smoke-register.cjs` y `__fixtures__/**` quedan fuera del barrel.
- `src/helpers/` — funciones puras: `asset-src`, `timeline-to-sequence-props`, `transition-timing`,
  `punch-in-style`, `audio-gain`, `timeline-metadata`, `timeline-types`, y la familia de kinetic
  captions (`caption-preset`, `caption-safe-zone`, `caption-box`, `caption-font-size`,
  `caption-word-style`, `caption-font-face`, `caption-animation`, `caption-active-word`,
  `caption-clip-plan`). Ninguno importa `remotion`: cargan igual en un `Player` de browser que en Node.
- `src/components/` — `TimelineComposition` (con `calculateTimelineMetadata`), `ArollSeries`,
  `BrollTrack`, `AudioTrack`, `KineticCaptions` (en el barrel); `CaptionPresetGallery` (solo para
  `remotion studio`, fuera del barrel).
- `src/transitions/` — presentaciones propias (whip-pan) sobre `@remotion/transitions`
- `src/Root.tsx` — composiciones de ejemplo para `remotion studio` (`TimelineComposition` 9:16,
  `TimelineCompositionLandscape` 16:9, `CaptionPresetGallery` 4320x1920)
- `src/render.ts` — entrada Node (`renderTimeline`) separada del barrel React
- `src/__fixtures__/` — Timeline de ejemplo construida con `buildTimeline`

## 4. Convenciones propias

- **Render como función**: `Timeline` entra, frames salen; sin estado propio ni I/O en componentes
- **Helpers puros testeables sin montar Remotion**; los componentes se prueban por sus helpers y layout
- **El límite browser/Node lo hace cumplir `eslint.config.mjs` de la lib**, no una convención: prohíbe
  `node:*`/`fs`/`path`/`child_process`/`os` y `@remotion/bundler`/`@remotion/renderer` en todo `src/**`
  salvo `src/render.ts` y `src/smoke.ts`; también prohíbe `Date`, `process` y `Math.random` en el
  barrel. Boundaries Nx: `type:ui` → `onlyDependOnLibsWithTags: ['type:domain']`.
- **`renderTimeline(timeline, options, deps = remotionRenderDeps)`**: `bundleProject`,
  `selectTimelineComposition` y `renderTimelineMedia` son puertos de `RenderTimelineDeps`; el default
  de producción los resuelve con `await import()` dinámico. Errores tipados vía `RenderTimelineError`
  (`INVALID_TIMELINE` / `BUNDLE_FAILED` / `COMPOSITION_NOT_FOUND` / `RENDER_FAILED`).
- **`trimBefore`, no `startFrom`/`endAt`** (deprecados desde Remotion 4.0.319): única conversión que
  la lib hace sobre la Timeline (`trimStartMs → trimBefore` vía `msToFrames`).
- **Alias de workspace en los TRES resolvedores** (lección más cara del repo): `tsconfig.base.json`
  no alcanza. Hace falta declarar `@video-maker/timeline-core` también en `resolve.alias` de
  `vite.config.ts` de la lib (para que Vitest resuelva valores en runtime) y en el `webpackOverride`
  que `render.ts` pasa a `bundleProject` de `@remotion/bundler` vía `WORKSPACE_ALIASES` /
  `withWorkspaceAliases` (para que el bundle de Remotion resuelva el import). Sin los tres, algo falla
  en silencio o en runtime aunque `lint`/`build` estén verdes.
- **Precedencia de caja de captions:** `captionClipPlan` usa `boxSource` con default `'preset'` —
  `buildTimeline` siempre rellena `CaptionClip.box`, así que un default `'clip'` anularía las safe
  zones/anchor/`boxHeightRatio` sin que ningún test lo note.
- **Un solo `transform` por elemento** en la jerarquía de `KineticCaptions`: caja (posición/fontSize,
  sin transform) > bloque (`opacity` + `transform`) > palabra.
- **Presets sin píxeles absolutos**: todo ratio contra `format.height` o `em` contra el `fontSize` del
  clip. `CaptionPreset` exige el campo `animation: CaptionAnimation`.
- **Sin comentarios** en el código; nombres declarativos, componentes cortos
- Tags Nx: `scope:engine`, `type:ui`. Depende solo de `libs/timeline-core`
- Targets: `lint`, `test` (`vitest run --coverage --passWithNoTests`, umbral 80 % sobre
  `src/helpers/**` + `src/transitions/**`, real 96.77 % stmts / 93.16 % branches), `build`
  (`tsc -p tsconfig.lib.json`), `smoke` (manual: `node -r ./src/smoke-register.cjs ./src/smoke.ts`
  con `SWC_NODE_PROJECT=./tsconfig.smoke.json` — produjo un render real el 2026-09-08), `studio`
  (manual, `remotion studio`)
