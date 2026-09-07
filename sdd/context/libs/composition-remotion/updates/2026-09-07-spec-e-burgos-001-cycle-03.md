# spec-e-burgos-001-core-composition-media-pipeline cycle-03 — 2026-09-07

## Estado

- Lib creada y completa para su alcance de `cycle-03`. Helpers puros: `timelineToSequenceProps`,
  `transitionTiming`, `punchInStyle`, `captionLayout`, `assetSrc`, `gainDbToVolume`,
  `volumeAtFrame`, `computeTimelineMetadata`. Componentes: `TimelineComposition` (con
  `calculateTimelineMetadata`), `ArollSeries` (TransitionSeries + fade/slide/whip-pan propia,
  `light-leak` degradado a fade), `BrollTrack` (cover/contain/pip), `AudioTrack` (voz + música con
  automation de ganancia) y `CaptionTrack` mínimo dentro del safe zone. Entrada Node
  `renderTimeline` con puertos inyectables. CA-023..CA-026 en verde; CA-027 verificado como
  procedimiento documentado (target `smoke` + README), nunca ejecutado en CI. 69 tests, cobertura
  94 % stmts / 87.87 % ramas sobre `src/helpers/**` + `src/transitions/**`, sin montar Remotion ni
  descargar Chrome.
- `resolve: context_prompt.md "Estado: en construcción — cycle-03 abierto"` → `cycle-03` cerrado y
  con él la spec `spec-e-burgos-001` completa (3 ciclos). La lib vuelve a tocarse en `spec-003`
  (kinetic captions, reemplaza el `CaptionTrack` mínimo), `spec-004` (mezcla de audio) y `spec-006`
  (Player en `apps/web`).

## Estructura

- Árbol real de `src/`: `helpers/` (`asset-src`, `timeline-to-sequence-props`, `transition-timing`,
  `punch-in-style`, `caption-layout`, `audio-gain`, `timeline-metadata`, `timeline-types`),
  `components/` (`aroll-series`, `broll-track`, `audio-track`, `caption-track`,
  `timeline-composition`), `transitions/` (`whip-pan-style.ts`, `whip-pan.tsx`,
  `presentation-for.ts`), `__fixtures__/` (`example-edl.ts`, `example-timeline.ts`), más
  `Root.tsx`, `remotion-entry.ts`, `render.ts` y `smoke.ts`.
- **Dos entry points, dos alias en `tsconfig.base.json`:** `@video-maker/composition-remotion` →
  `src/index.ts` (barrel browser-safe) y `@video-maker/composition-remotion/render` →
  `src/render.ts` (Node puro). `registerRoot` vive **solo** en `src/remotion-entry.ts`; `Root.tsx`
  no tiene efectos de módulo y por eso puede importarse desde cualquier lado sin registrar nada.
  `Root.tsx`, `remotion-entry.ts`, `smoke.ts` y `__fixtures__/**` quedan fuera del barrel.
- **El límite browser/Node lo hace cumplir ESLint, no una convención.** `eslint.config.mjs` de la
  lib prohíbe `node:*`/`fs`/`path`/`child_process`/`os` y `@remotion/bundler`/`@remotion/renderer`
  en todo `src/**` salvo `src/render.ts` y `src/smoke.ts`; además prohíbe `Date`, `process` y
  `Math.random` en el barrel (determinismo: un frame se calcula desde `frame`, nunca desde el
  reloj). Boundaries Nx: `type:ui` → `onlyDependOnLibsWithTags: ['type:domain']`.
- **`renderTimeline(timeline, options, deps = remotionRenderDeps)`**: los tres pasos del render
  (`bundleProject`, `selectTimelineComposition`, `renderTimelineMedia`) son puertos de
  `RenderTimelineDeps`; el default de producción los resuelve con `await import()` **dinámico**, de
  modo que ni siquiera cargando el módulo se toca un paquete nativo. Por eso `render.spec.ts` prueba
  el contrato completo con dobles y la suite corre sin ffmpeg ni Chrome (RNF-3). Errores tipados vía
  `RenderTimelineError` (`INVALID_TIMELINE` / `BUNDLE_FAILED` / `COMPOSITION_NOT_FOUND` /
  `RENDER_FAILED`), con `validateTimeline` corriendo antes de bundlear.
- **`trimBefore`, no `startFrom`:** `startFrom`/`endAt` están deprecados desde Remotion 4.0.319.
  `timelineToSequenceProps` convierte `trimStartMs → trimBefore` (frames) con `msToFrames` y
  `OffthreadVideo`/`Audio` reciben ya frames. Es la única conversión que la lib hace sobre la
  Timeline: todo el resto (`from`, `durationFrames`, `scale`) se copia tal cual.
- **`transitionTiming` acota la transición a 2 s** (`clampTransitionFrames`, mínimo 1 frame) usando
  el `fps` de la Timeline; para los valores reales del ciclo (9 frames @30) es identidad.
- `vite.config.ts` necesita `resolve.alias` de `@video-maker/timeline-core` (lección de `cycle-02`)
  y `environment: 'jsdom'` + `@vitejs/plugin-react`; el `include` de cobertura es
  `src/helpers/**/*.ts` + `src/transitions/**/*.ts` con umbral 80 %.
- **Assets de ejemplo:** `public/example/` está gitignoreado por completo. El README trae los
  comandos `ffmpeg` exactos que generan `aroll.mp4`, `broll.jpg` y `music.mp3` con las duraciones
  que declara `src/__fixtures__/example-edl.ts`. Sin esos tres archivos, `studio` y `smoke` no
  muestran material (los tests no los necesitan).

## Dependencias

- Runtime nuevo en el `package.json` raíz, todas en versión exacta única **4.0.522**: `remotion`,
  `@remotion/transitions`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`. `react` /
  `react-dom` ^19 ya estaban.
- Dev nuevo: `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`,
  `@nx/react`. `@swc-node/register` (ya presente desde `cycle-01`) es lo que corre el target
  `smoke` — de ahí que `render.ts` use `__dirname` y no `import.meta.url`.
- Alias `@video-maker/composition-remotion` y `.../render` agregados a `tsconfig.base.json`.
  Depende solo de `@video-maker/timeline-core`; no consume `media-local`.
- `licenseKey: 'free-license'` en `renderMedia` (Remotion 4 lo exige explícitamente).

## Qué sigue

- **Targets manuales, nunca en CI:** `pnpm nx run composition-remotion:studio` (abre
  `remotion studio` sobre `src/remotion-entry.ts`, composiciones `TimelineComposition` 9:16 y
  `TimelineCompositionLandscape` 16:9) y `pnpm nx run composition-remotion:smoke` (renderea
  `out/example-9x16.mp4`, MP4 1080×1920@30, 265 frames). Ambos pueden descargar Chrome Headless
  Shell la primera vez. Correr el render **después** de transcribir, nunca en paralelo, con
  concurrencia 4.
- **`OffthreadVideo` vs `Video` — pendiente para `spec-006`.** La lib usa `OffthreadVideo` porque es
  lo que optimiza el render a MP4; dentro de un `<Player>` de browser no es equivalente. Montar esta
  composición en `apps/web` va a requerir un componente de video conmutable (`Video` en el Player,
  `OffthreadVideo` en el render). No se resolvió acá para no diseñar contra un consumidor
  inexistente.
- **La rama `file://` de `assetSrc` (rutas absolutas) no está verificada con un render real.** El
  camino ejercitado es relativo + `staticFile()`. Si Chrome bloqueara sub-recursos `file://`, el
  fallback es `RenderTimelineOptions.publicDir` apuntando al directorio real de assets.
- El `anchor` del punch-in no viaja en la `Timeline` (D-16): `punchInStyle` lo acepta como parámetro
  y `ArollSeries` usa siempre el default `center`. Corresponde a `spec-002` extender el contrato.
- `widenPresentation` (`aroll-series.tsx`) castea el tipo unión `ArollPresentation` a
  `TransitionPresentation<Record<string, unknown>>`: `TransitionSeries.Transition` es genérico en un
  único `PresentationProps` y con `exactOptionalPropertyTypes` no acepta la unión. Único cast de la
  lib, aislado en una función con nombre; revisarlo cuando `spec-003` agregue presentaciones nuevas.
