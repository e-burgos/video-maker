# Context Prompt — libs/composition-remotion

> Entry point para agentes que trabajen sobre `libs/composition-remotion`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-002 cycle-03 + spec-e-burgos-004 cycle-02 + FIX-e-burgos-001-001 | Fecha: 2026-09-08

- **Tipo:** lib React 19 + Remotion 4
- **Estado:** completa y libre, sin ciclo abierto sobre esta lib. `spec-e-burgos-001` (3 ciclos) y
  `spec-e-burgos-003` (2 ciclos, kinetic captions) están `completed`. `spec-e-burgos-002` cycle-03
  (wiring del `anchor` de punch-in, un solo call site) y `spec-e-burgos-004` cycle-02 (modo de audio
  `muted`) ya tocaron esta lib y cerraron su parte acá.
- **Specs que la gobiernan:**
  `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md`
  (sección "Composición"),
  `sdd/specs/spec-e-burgos-003-kinetic-captions/spec-e-burgos-003-kinetic-captions.spec.md`,
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (CA-015, `anchor` del punch-in) y
  `sdd/specs/spec-e-burgos-004-audio-mix-mastering/spec-e-burgos-004-audio-mix-mastering.spec.md`
  (CA-011, modo `audio: 'muted'`)
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test composition-remotion`, `pnpm nx lint composition-remotion`,
  `pnpm nx build composition-remotion`; manuales: `pnpm nx run composition-remotion:studio`,
  `pnpm nx run composition-remotion:smoke` (genera `out/example-9x16.mp4`, gitignoreado; ambos pueden
  descargar Chrome Headless Shell la primera vez)
- **Consumidores:** `apps/web` (Player, previsto para `spec-006`), `apps/render-api` (previsto,
  orquestación de `spec-005`), `tools/render-cli` (activo — solo por el subpath
  `@video-maker/composition-remotion/render`, `renderTimeline` + `RenderTimelineError`, nunca por el
  barrel; ese aislamiento deja a la lib libre para reorganizar el barrel sin romper la CLI)
- **Vuelve a tocarse en:** `spec-e-burgos-005` (orquesta `render → mix → mux` en `apps/render-api` —
  el único subproyecto que puede depender tanto de esta lib como de `media-local`, ver §15 del
  `architect.md` de `spec-e-burgos-004` cycle-02 para el orden de llamadas y la tabla de errores;
  también amplía el `include` de cobertura de `vite.config.ts` a `src/render.ts` y
  `src/components/**`), `spec-e-burgos-006` (Player de `apps/web`)
- **Assets de ejemplo:** `public/example/` gitignoreado — el README trae los comandos `ffmpeg` para
  generar `aroll.mp4`/`broll.jpg`/`music.mp3`. `public/fonts/` para fuentes propias del creador
  (también gitignoreado).

## Qué sigue

- `OffthreadVideo` (usado en el render) vs `Video` (necesario en un `<Player>` de browser): resolver
  al construir el Player de `spec-006` con un componente de video conmutable.
- La rama `file://` de `assetSrc` (rutas absolutas) no está verificada con un render real; el camino
  ejercitado es relativo + `staticFile()`. Fallback conocido: `RenderTimelineOptions.publicDir`.
- `src/components/**` sigue sin tests y fuera de la cobertura. El wiring del `anchor` del punch-in
  (`ArollScene` → `punchInStyle`) y el montaje condicional de `AudioTrack` según `audio` están
  verificados solo por render real: si alguien los refactoriza, ningún test lo marca. La premisa de
  que hacía falta tocar `vite.config.ts` para poder testear el componente es falsa — ya declara
  `include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx']`, `jsdom` y el plugin de React; el obstáculo
  real es que `ArollScene` no se exporta y montar `ArollSeries`/`TimelineComposition` exige el
  contexto de frame de Remotion. Ampliar el `include` de cobertura a `src/render.ts` y
  `src/components/**` es follow-up de `spec-005`.
- `widenPresentation` (`aroll-series.tsx`) tiene el único cast de la lib (`ArollPresentation` →
  `TransitionPresentation<Record<string, unknown>>`, por `exactOptionalPropertyTypes`); revisar si se
  agregan presentaciones nuevas.
- `heightCap` de `fitCaptionFontSize` es hoy inerte: ningún preset actual lo activa.
- `averageCharWidthEm` es estimación, no medición; los insets de chrome por plataforma también son
  valores declarados, no medidos contra capturas reales de las apps.
- `render → mix → mux` en una sola llamada no puede vivir en esta lib ni en `media-local`: los
  boundaries Nx (`type:ui`/`type:util` → sólo `type:domain`) lo impiden. Es responsabilidad de
  `spec-e-burgos-005` en `apps/render-api`; mientras tanto el procedimiento encadenado queda
  documentado como pasos manuales en los README de ambas libs.
