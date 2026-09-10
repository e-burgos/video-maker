# spec-e-burgos-015-studio-producer cycle-01 — 2026-09-10

## Estado
`render` (y por lo tanto `run`) entrega la **misma mezcla masterizada** que el job `render` de
`apps/render-api`, no el audio que dibuja Remotion. Medido sobre `media/demo-01`: el desfase
contra la locución pasa de **+40 ms constantes a 0 ms**, y el `sha256` del audio decodificado del
entregable es **idéntico** al del MP4 que produce la API (`e1030289ca9798d3858041bb`).

## Estructura
- `renderCommand` hace cuatro pasos en vez de uno: `renderTimeline(..., { audio: 'muted' })` →
  `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. Los intermedios viven en
  `work/renders/<slug>/` (`video-muted.mp4`, `master.wav`) con el mismo layout que la API;
  el entregable sigue siendo `out/<slug>.mp4` (**el nombre no cambió**, a diferencia del uuid de
  la API). Las rutas las resuelve `pipeline/master-render-paths.ts`.
- `CliDependencies` gana tres puertos: `mixTimelineAudio`, `muxAudioIntoVideo` y
  `verifyMixLoudness` (tipos en `deps/timeline-renderer.ts`). El doble de
  `__fixtures__/fake-cli-dependencies.ts` los trae con implementaciones pasamanos y
  `DEFAULT_FAKE_MIX_LOUDNESS`; `FakeFileSystem` gana `directories()`.
- `RenderReport` gana `mutedVideoPath`, `masterAudioPath` y `loudness` (los cinco campos de la
  verificación). `toRenderReport` cambió de firma: `(outcome, loudness, paths, project)`, y su
  `outPath` es el **entregable muxeado**, no el `outPath` que devolvió Remotion.
- `Stage` **no** se ensanchó: `mix`, `mux` y `verify` son pasos internos de la etapa `render`, así
  que los exit codes (4/5/6) y `stageForArgument` no cambian. Un error de `media-local` en
  cualquiera de los tres sale como `STAGE_FAILED` con `stage: 'render'` y el entregable como
  `resource`.

## Dependencias
Ninguna nueva. **`@video-maker/media-local` entra por `import` estático y tiene que seguir así**:
cargarlo con `await import()` en un solo archivo marca la lib entera como lazy-loaded para
`@nx/enforce-module-boundaries` y rompe el lint de los ocho archivos que la importan estáticamente.
El único perezoso de la CLI es `@video-maker/composition-remotion/render`.

## Qué sigue
El render sigue siendo el paso caro (37 s de reloj para 778 frames a 1080×1920 en esta máquina) y
`render` no reusa el `video-muted.mp4` anterior aunque la Timeline no haya cambiado: cada corrida
rerenderiza. Cachearlo por hash de la Timeline es decisión de otro ciclo.
