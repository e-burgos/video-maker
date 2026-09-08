# Context Prompt — libs/composition-remotion

> Entry point para agentes que trabajen sobre `libs/composition-remotion`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 (spec-e-burgos-003) + FIX-e-burgos-001-001 | Fecha: 2026-09-08

- **Tipo:** lib React 19 + Remotion 4
- **Estado:** completa y libre, sin ciclo abierto. `spec-e-burgos-001` (3 ciclos) y
  `spec-e-burgos-003` (2 ciclos, kinetic captions) están `completed`.
- **Specs que la gobiernan:**
  `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md`
  (sección "Composición") y
  `sdd/specs/spec-e-burgos-003-kinetic-captions/spec-e-burgos-003-kinetic-captions.spec.md`
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test composition-remotion`, `pnpm nx lint composition-remotion`,
  `pnpm nx build composition-remotion`; manuales: `pnpm nx run composition-remotion:studio`,
  `pnpm nx run composition-remotion:smoke` (genera `out/example-9x16.mp4`, gitignoreado; ambos pueden
  descargar Chrome Headless Shell la primera vez)
- **Consumidores previstos:** `apps/web` (Player), `apps/render-api`, `tools/render-cli`
- **Vuelve a tocarse en:** `spec-002` (punch-in anchor en la Timeline), `spec-004` (mezcla de audio),
  `spec-006` (Player de `apps/web`)
- **Assets de ejemplo:** `public/example/` gitignoreado — el README trae los comandos `ffmpeg` para
  generar `aroll.mp4`/`broll.jpg`/`music.mp3`. `public/fonts/` para fuentes propias del creador
  (también gitignoreado).

## Qué sigue

- `OffthreadVideo` (usado en el render) vs `Video` (necesario en un `<Player>` de browser): resolver
  al construir el Player de `spec-006` con un componente de video conmutable.
- La rama `file://` de `assetSrc` (rutas absolutas) no está verificada con un render real; el camino
  ejercitado es relativo + `staticFile()`. Fallback conocido: `RenderTimelineOptions.publicDir`.
- El `anchor` del punch-in no viaja en la `Timeline`: `punchInStyle` lo acepta como parámetro pero
  `ArollSeries` usa siempre el default `center`. Corresponde a `spec-002` extender el contrato.
- `widenPresentation` (`aroll-series.tsx`) tiene el único cast de la lib (`ArollPresentation` →
  `TransitionPresentation<Record<string, unknown>>`, por `exactOptionalPropertyTypes`); revisar si se
  agregan presentaciones nuevas.
- `heightCap` de `fitCaptionFontSize` es hoy inerte: ningún preset actual lo activa.
- `averageCharWidthEm` es estimación, no medición; los insets de chrome por plataforma también son
  valores declarados, no medidos contra capturas reales de las apps.
