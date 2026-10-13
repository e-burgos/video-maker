# Context Prompt — libs/composition-remotion

> Entry point para agentes que trabajen sobre `libs/composition-remotion`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

- **Tipo:** lib React 19 + Remotion 4
- **Desde spec-017/021/023:** render desde bundle precompilado, preset `brand`, bumpers de logo, rango de cuadros para
  muestras y geometría delegada en timeline-core (detalle en `constitution.md` §3).
- **Estado:** completa y libre, sin ciclo abierto sobre esta lib. `spec-e-burgos-001` (3 ciclos),
  `spec-e-burgos-003` (2 ciclos, kinetic captions), `spec-e-burgos-006-web-studio` (`cycle-02` y
  `cycle-03`, Player de `apps/web`) y `spec-e-burgos-014-production-quality` (`cycle-01`, logo y
  normalización de música) están `completed`. `spec-e-burgos-002` cycle-03 (wiring del `anchor` de
  punch-in) y `spec-e-burgos-004` cycle-02 (modo de audio `muted`) también cerraron su parte acá.
  `FIX-001-002` (D-6 de `spec-005`) midió `render.ts` en cobertura; `FIX-003-003` hizo el estilo de
  captions una decisión del documento; `FIX-003-004` rediseñó `subtle-lower` como subtítulo.
- **Specs que la gobiernan:**
  `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md`
  (sección "Composición"),
  `sdd/specs/spec-e-burgos-003-kinetic-captions/spec-e-burgos-003-kinetic-captions.spec.md`
  (`FIX-003-003`/`FIX-003-004` reajustaron los presets después de cerrada),
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (CA-015, `anchor` del punch-in),
  `sdd/specs/spec-e-burgos-004-audio-mix-mastering/spec-e-burgos-004-audio-mix-mastering.spec.md`
  (CA-011, modo `audio: 'muted'`),
  `sdd/specs/spec-e-burgos-005-render-service` (`FIX-001-002`, cobertura honesta de `render.ts`),
  `sdd/specs/spec-e-burgos-006-web-studio` (`cycle-02`: `TimelineVideo`/`VideoBackendProvider`;
  `cycle-03`: alineó el encuadre del preview al del render) y
  `sdd/specs/spec-e-burgos-014-production-quality` (`cycle-01`: `LogoOverlay` y normalización de
  música en `AudioTrack`)
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/`)
- **Cómo correr y testear:** `pnpm nx test composition-remotion`, `pnpm nx lint composition-remotion`,
  `pnpm nx build composition-remotion`; manuales: `pnpm nx run composition-remotion:studio`,
  `pnpm nx run composition-remotion:smoke` (genera `out/example-9x16.mp4`, gitignoreado; ambos pueden
  descargar Chrome Headless Shell la primera vez)
- **Consumidores:** `apps/web` (Player, activo desde `spec-006`), `apps/render-api` (activo, orquesta
  `render → mix → mux → verify` con el subpath `/render`), `tools/render-cli` (activo — solo por el
  subpath `@video-maker/composition-remotion/render`, `renderTimeline` + `RenderTimelineError`, nunca
  por el barrel; ese aislamiento deja a la lib libre para reorganizar el barrel sin romper la CLI)
- **Assets de ejemplo:** `public/example/` gitignoreado — el README trae los comandos `ffmpeg` para
  generar `aroll.mp4`/`broll.jpg`/`music.mp3`. `public/fonts/` para fuentes propias del creador
  (también gitignoreado).

## Qué sigue

- **`[FIX]` pendiente — el encuadre del render**: dar a `ArollScene` un `COVER_MEDIA_STYLE` idéntico
  al de `BrollTrack` (`{ width: '100%', height: '100%', objectFit: 'cover' }`), re-basar el `sha256`
  de no-regresión (`c1b9fd9f…` → `2ed415d8…`) y regenerar `render-frame-reference-8s.png`. Alcance ya
  redactado en el fragmento consolidado de `spec-006 cycle-03`; es cambio deliberado del entregable,
  no una regresión, y necesita contenido no uniforme para distinguir `cover` de `fill`
  (`media/smoke-ingest/raw/aroll/clip01.mp4` es azul casi plano — el frame 240/t 8 s fue el elegido
  para el oráculo de paridad de `cycle-03`).
- La rama `file://` de `assetSrc` (rutas absolutas) no está verificada con un render real; el camino
  ejercitado es relativo + `staticFile()`. El Player la evita a propósito (`apps/web` reescribe los
  assets a URLs `http://` antes de montar). Fallback conocido: `RenderTimelineOptions.publicDir`.
- **El resto de `src/components/**`** (`ArollSeries`/`ArollScene`, `BrollTrack`, `KineticCaptions`,
  `LogoOverlay`) sigue sin tests propios y fuera de `coverage.include`, con fundamento medido (ver
  constitution.md § Targets): incluirlo baja branch/funcs bajo el piso de 80 % y Vitest 4.1.11 no
  soporta un threshold distinto por glob. Su evidencia es el smoke E2E y la paridad de `sha256`/PSNR.
  El wiring del `anchor` del punch-in (`ArollScene` → `punchInStyle`) y el montaje condicional de
  `AudioTrack`/`LogoOverlay` están verificados solo por render real: un refactor ahí no lo marca
  ningún test.
- `widenPresentation` (`aroll-series.tsx`) tiene el único cast de la lib (`ArollPresentation` →
  `TransitionPresentation<Record<string, unknown>>`, por `exactOptionalPropertyTypes`); revisar si se
  agregan presentaciones nuevas.
- `heightCap` de `fitCaptionFontSize` es hoy inerte: ningún preset actual lo activa.
- `averageCharWidthEm` es estimación, no medición; los insets de chrome por plataforma también son
  valores declarados, no medidos contra capturas reales de las apps.
- El margen lateral de `subtle-lower` (0.2) no está garantizado contra el logo en 9:16 (ver
  constitution.md): si se usa ese preset en vertical, derivar el margen del logo en vez de dejarlo
  fijo.
- `planDucking` de `libs/timeline-core` pierde la cola de release cuando dos valles están cerca
  (`FIND-01` de `spec-006 cycle-03`): afecta la curva que esta lib consume por `automation`, en el
  render y en el preview por igual — es un follow-up de `timeline-core`, no de esta lib.
- `render → mix → mux → verify` en una sola llamada no puede vivir en esta lib ni en `media-local`:
  los boundaries Nx (`type:ui`/`type:util` → sólo `type:domain`) lo impiden. Vive en
  `apps/render-api` (`spec-e-burgos-005`) y en `tools/render-cli`.
