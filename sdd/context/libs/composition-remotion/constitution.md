# Constitución — libs/composition-remotion

> Versión 1.0 | Última actualización: spec-e-burgos-002 cycle-03 + spec-e-burgos-004 cycle-02 + FIX-e-burgos-001-001 | Fecha: 2026-09-08
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
- `src/components/` — `TimelineComposition` (con `calculateTimelineMetadata` y el tipo
  `TimelineAudioMode` que controla si monta `AudioTrack`), `ArollSeries` (con `ArollScene`, no
  exportado), `BrollTrack`, `AudioTrack`, `KineticCaptions` (en el barrel); `CaptionPresetGallery`
  (solo para `remotion studio`, fuera del barrel).
- `src/transitions/` — presentaciones propias (whip-pan) sobre `@remotion/transitions`
- `src/Root.tsx` — composiciones de ejemplo para `remotion studio` (`TimelineComposition` 9:16,
  `TimelineCompositionLandscape` 16:9, `CaptionPresetGallery` 4320x1920); sus `defaultProps` no
  declaran `audio`, así que el preview de `remotion studio` y del `<Player>` sigue mostrándose con
  audio (`AudioTrack` montado)
- `src/render.ts` — entrada Node (`renderTimeline`) separada del barrel React
- `src/__fixtures__/` — Timeline de ejemplo construida con `buildTimeline`
- **Tooling de `smoke` aislado de `tsc`/`build`:** `tsconfig.smoke.json` (extiende
  `tsconfig.lib.json`, `baseUrl: "../.."`) y `src/smoke-register.cjs` (acota el registro de
  `@swc-node/register` a `.ts`/`.tsx`, devolviéndole a Node su loader nativo de `.js` para que no
  intente compilar `.js` de terceros inyectados en el proceso mientras Remotion bundlea con
  webpack) sólo los usa el target `smoke`; no afectan `build` (sigue con `tsc` vía
  `tsconfig.lib.json`) ni las `references` de `tsconfig.json`.

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
- **`options.audio?: TimelineAudioMode` (`'mix' | 'muted'`) en `renderTimeline`, mismo prop en
  `TimelineComposition`:** default `'mix'` (comportamiento anterior, `AudioTrack` montado); con
  `'muted'` la composición no monta `AudioTrack`. Lo usa el pipeline real para producir el video
  sin audio y muxearle después la mezcla masterizada de `media-local` (spec-004) — si Remotion
  mezclara su propio audio y encima se le muxeara la masterizada, el entregable saldría con el
  audio duplicado. **Invariante estructural, no de valor:** `renderTimeline` arma `inputProps` como
  `{ timeline, ...(options.audio === 'muted' ? { audio: options.audio } : {}) }` — la clave `audio`
  **sólo aparece cuando vale `'muted'`**; nunca introducir un default explícito (`?? 'mix'`), rompe
  los tests que comparan `inputProps: { timeline }` por igualdad estructural.
- **`trimBefore`, no `startFrom`/`endAt`** (deprecados desde Remotion 4.0.319): única conversión que
  la lib hace sobre la Timeline (`trimStartMs → trimBefore` vía `msToFrames`).
- **Alias de workspace en los TRES resolvedores** (lección más cara del repo, origen: un
  `@video-maker/*` resuelto por `@swc-node/register` contra el `tsconfig.json` de la lib en vez de
  la raíz del workspace donde vive `tsconfig.base.json`, que rompió el target `smoke` desde que se
  creó): `tsconfig.base.json` no alcanza. Hace falta declarar `@video-maker/timeline-core` también
  en `resolve.alias` de `vite.config.ts` de la lib (para que Vitest resuelva valores en runtime) y
  en el `webpackOverride` que `render.ts` pasa a `bundleProject` de `@remotion/bundler` vía
  `WORKSPACE_ALIASES` / `withWorkspaceAliases` (para que el bundle de Remotion resuelva el import;
  el tipo `WebpackConfiguration` se toma re-exportado de `@remotion/bundler`, sin declarar
  `webpack` como dependencia propia). Sin los tres, algo falla en silencio o en runtime aunque
  `lint`/`build` estén verdes.
- **El punch-in respeta el `anchor` de la escena:** `ArollScene` (en `aroll-series.tsx`) llama
  `punchInStyle(scene.transform, scene.transform.anchor)`; sin ese segundo argumento el punch-in
  escala siempre desde `center`, aunque `ClipTransform.anchor` diga otra cosa. Verificado por
  render real, no por test: `src/components/**` queda fuera del `include` de cobertura y
  `ArollScene` no se exporta, así que un regreso al default `center` no lo marca ningún test.
- **`gainDbToVolume` está duplicada a propósito** entre `src/helpers/audio-gain.ts` (esta lib) y
  `libs/media-local/src/mix/gain-db-to-volume.ts`: los boundaries Nx (`type:ui`/`type:util` → sólo
  `type:domain`) impiden compartirla entre libs hermanas. La tabla de §7.2 de `cycle-01` de
  `spec-e-burgos-004-audio-mix-mastering` es su contrato de paridad — cualquier cambio en una
  obliga a replicarlo en la otra o el master deja de coincidir con el preview. La paridad se
  promete para la curva de ducking de música, no para el nivel absoluto de voz (el master aplica
  `loudnorm`; el preview no).
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
  `src/helpers/**` + `src/transitions/**`, real 96.77 % stmts / 93.16 % branches / 98.07 % funcs
  sobre 249 tests — `src/render.ts` y `src/components/**` quedan **fuera** de ese `include`, sin
  ningún threshold que los vigile), `build` (`tsc -p tsconfig.lib.json`), `smoke` (manual:
  `node -r ./src/smoke-register.cjs ./src/smoke.ts` con `SWC_NODE_PROJECT=./tsconfig.smoke.json` —
  produjo un render real el 2026-09-08, y otro más el mismo día vía `tools/render-cli`), `studio`
  (manual, `remotion studio`)
