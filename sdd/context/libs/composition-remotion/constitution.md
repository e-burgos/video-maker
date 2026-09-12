# Constitución — libs/composition-remotion

> Versión 1.1 | Última actualización: FIX-e-burgos-003-004 | Fecha: 2026-09-11
> Consolidada al cerrar `FIX-e-burgos-003-004` (fundió los fragmentos de `FIX-001-002`,
> `spec-006 cycle-02`, `spec-006 cycle-03`, `spec-014 cycle-01`, `FIX-003-003` y `FIX-003-004`).
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
- `src/components/` — `TimelineComposition` (con `calculateTimelineMetadata`, el tipo
  `TimelineAudioMode` que controla si monta `AudioTrack`, y el estilo de captions resuelto de
  `timeline.captionStyle ?? captionPreset`), `ArollSeries` (con `ArollScene`, no exportado),
  `BrollTrack`, `AudioTrack`, `KineticCaptions`, `LogoOverlay`, `TimelineVideo`,
  `VideoBackendProvider`/`useVideoBackend` (en el barrel); `CaptionPresetGallery` (solo para
  `remotion studio`, fuera del barrel).
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
- **El estilo de captions lo decide el documento, no el preview**: `captionPresetIdForStyle(style,
  fallback)` resuelve `timeline.captionStyle ?? captionPreset` — el `captionStyle` de la `Timeline`
  **gana** sobre la prop `captionPreset` (el override del preview), porque el documento es la
  decisión editorial persistida. `'off'` no monta `<KineticCaptions>`.
- **`subtle-lower` es un subtítulo de película, no un caption cinético**: sans-serif blanco, contorno
  fino, sin píldora ni realce ni animación por palabra, `maxLines: 2` (los tres presets cinéticos
  declaran `1`). `CaptionPreset.maxLines` alimenta tanto el ajuste de tamaño
  (`caption-font-size.ts`, reparte el ancho entre `maxLines` líneas) como el padding lateral de la
  caja (`sidePaddingRatio`, default `0` para no mover los demás presets) — los dos tienen que
  coincidir o el envolvimiento no calza con el tamaño calculado. El margen lateral de
  `subtle-lower` (0.2) es lo que lo separa del logo por defecto en 16:9; en 9:16 esa separación
  **no** está garantizada (el logo por defecto ocupa 0.28 del ancho) y habría que derivarlo del
  logo en vez de dejarlo fijo si `subtle-lower` se usa en vertical.
- **Un solo `transform` por elemento** en la jerarquía de `KineticCaptions`: caja (posición/fontSize,
  sin transform) > bloque (`opacity` + `transform`) > palabra.
- **Presets sin píxeles absolutos**: todo ratio contra `format.height` o `em` contra el `fontSize` del
  clip. `CaptionPreset` exige el campo `animation: CaptionAnimation`.
- **El logo se dibuja entre `BrollTrack` y `KineticCaptions`** (nunca puede tapar texto) y también
  con `audio: 'muted'`, porque el video mudo es el que se muxea. `logoOverlayBox`/`logoOverlayStyle`
  (`helpers/logo-overlay-style.ts`, puro) calculan ancho y margen contra `format.width` y emiten
  sólo la esquina que corresponde; un `assetId` que no resuelve cae en `unresolvedAssetIds` en vez
  de romper el render.
- **`AudioTrack` normaliza la música con `volumeAtFrame(automation, frame, offsetDb)`**, no con
  `gainDbToVolume(music.baseGainDb)` a secas: el tercer parámetro opcional es la
  `normalizationGainDb` que viene de `timeline-core` y se suma en dB antes de convertir a volumen
  (el clamp a 1 sigue aplicando, así que en el preview la cama nunca pasa de fondo de escala; en el
  master ese techo lo pone el `alimiter` del bus). Editar un nivel de música obliga a reescribir
  `audioMix.automation`, no esta función.
- **`TimelineVideo` conmuta `<Video>`/`<OffthreadVideo>` por `VideoBackendProvider`** (`'player'` →
  `<Video>`, cualquier otro caso, incluido sin proveedor, → `<OffthreadVideo>`) para que el
  `<Player>` de `apps/web` y el render compartan componente. Aplica `PLAYER_MEDIA_STYLE = {
  objectFit: 'fill' }` **sólo en la rama `player`**, con el spread `{ ...PLAYER_MEDIA_STYLE,
  ...style }` — el estilo del llamador gana, no invertir el orden (rompe el `cover`/`contain` de
  b-roll y pip). La rama `render` recibe el `style` entrante sin agregar ni quitar claves: es lo que
  sostiene la paridad byte a byte del entregable.
- **Defecto conocido y deliberadamente no corregido todavía**: el render monta el video con
  `object-fit: fill` efectivo (estira anamórficamente), mientras el navegador computa `contain` por
  hoja de agente de usuario; se alineó el **preview al render** (no al revés) porque corregir el
  render cambia el `sha256` del entregable. El dev ve en el preview el mismo encuadre defectuoso que
  sale en el MP4. Corregirlo (dar a `ArollScene` un `COVER_MEDIA_STYLE` idéntico al de `BrollTrack`)
  es un `[FIX]` pendiente, con re-baseline de `sha256` incluido — no una regresión cuando se haga.
- **Sin comentarios** en el código; nombres declarativos, componentes cortos
- Tags Nx: `scope:engine`, `type:ui`. Depende solo de `libs/timeline-core`
- Targets: `lint`, `test` (`vitest run --coverage --passWithNoTests`, umbral 80 % sobre
  `coverage.include` — `src/helpers/**`, `src/transitions/**`, `src/render.ts` y sólo tres
  componentes: `timeline-video.tsx`, `video-backend.tsx` y `audio-track.tsx` (D-6 de
  `spec-005-render-service`: medir `render.ts` bajó el número de 97,61 % a algo honesto). Real:
  26 archivos / 303 tests, 94,42 % stmts · 93,45 % branch · 92,2 % funcs · 94,31 % lines. El resto
  de `src/components/**` (`ArollSeries`/`ArollScene`, `BrollTrack`, `KineticCaptions`,
  `LogoOverlay`) queda **fuera** de ese `include` con fundamento medido: incluirlo baja branch y
  funcs por debajo del piso de 80 %, y `Vitest 4.1.11` no soporta un threshold distinto por glob
  para esos archivos (tres formas de glob probadas, todas cuentan igual para el umbral global). Su
  evidencia es el smoke E2E con binarios reales y la paridad de `sha256`/PSNR contra un frame de
  referencia, no el reporte de v8), `build` (`tsc -p tsconfig.lib.json`), `smoke` (manual:
  `node -r ./src/smoke-register.cjs ./src/smoke.ts` con `SWC_NODE_PROJECT=./tsconfig.smoke.json` —
  produjo un render real el 2026-09-08 (538 frames a 1080×1920) y sucesivas corridas de
  no-regresión por `sha256` en `spec-006`), `studio` (manual, `remotion studio`)
