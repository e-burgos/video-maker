# spec-e-burgos-007-web-montage cycle-01 — 2026-09-09

## Estado

Segundo tipo de job en la misma cola en proceso: `kind: 'montage'` corre `ingestProject` +
`autoMontage` de `@video-maker/auto-montage` sobre `media/<slug>/`, con `preset`
(default `software-demo`) y `seed` (default `0`), y `overwrite` explícito para reemplazar
una `Timeline` ya persistida (`409 TIMELINE_ALREADY_EXISTS` sin él, verificado antes de
registrar el job: no aparece job nuevo en el listado).

Contrato: `EP-012`..`EP-015` y `EP-001` quedan en `updated` en `sdd/api.json`. Los cinco son
retro-compatibles con lo que `apps/web` ya consume — `apps/web` no se tocó en este ciclo
(`git diff --stat apps/web` vacío, 307/307 tests verdes). `POST /projects/:slug/jobs` lee body
por primera vez: body ausente, body vacío o body sin `kind` producen el mismo job de render que
antes, byte por byte; leerlo agrega `400 REQUEST_BODY_INVALID_JSON` y `413 REQUEST_BODY_TOO_LARGE`
como respuestas nuevas del endpoint. `Job` y `JobSummary` ganan `kind`; ningún campo ya publicado
cambió de nombre, tipo ni significado (aserción por `Object.keys(...).sort()` sobre el set
completo, no campo por campo).

`GET /health` reporta ahora los cuatro binarios de media (`ffmpeg`, `ffprobe`, `whisperCli`,
`whisperModel`) por nombre lógico y env var —nunca el path resuelto— y `capabilities.montageQueue`.
`cycle` sigue en `3` (D-8). El servicio degrada también cuando falta el modelo o el CLI de Whisper.

Progreso por etapa propia `discover | probe | transcribe | plan` por el mismo mecanismo de los
jobs de render, monótono, con contador `processedAssets`/`totalAssets` sólo en `probe` y
`transcribe`. Cancelación cooperativa idéntica a la de render, con checkpoints sólo entre llamadas
opacas (antes de `ingestProject` y antes de `autoMontage`), nunca en medio de ninguna de las dos.

Smoke real ejecutado y re-verificado de forma independiente: `edl.json` byte-idéntico entre CLI y
API (`sha256 f96256aa…c39bf`) y sensible al `seed`; render encadenado con `nb_frames=538`,
`r_frame_rate=30/1`, `codec_name=h264`, `1080x1920` en el stream de video.

## Estructura

- `src/jobs/` gana el pipeline de montaje: `run-montage-pipeline.ts` (orquesta las cuatro etapas),
  `montage-pipeline-observer.ts` (`checkpoint` de cancelación entre etapas),
  `montage-job-progress.ts` (progreso monótono por etapa), `montage-job-params.ts`
  (`parseMontagePreset`/`parseMontageSeed`/`parseMontageOverwrite`) y
  `montage-command-runner-decorator.ts` (decora el `CommandRunner` para atribuir la etapa en curso
  a cada invocación de binario sin que las libs conozcan la cola).
- `src/store/montage-preconditions.ts`: precondiciones de ingestabilidad del proyecto
  (`MONTAGE_RAW_MISSING`); `assertTimelineNotPersisted` vive en `project-scope.ts`.
- `src/errors/translate-montage-error.ts`: traduce los códigos de `auto-montage` y `media-local` a
  la superficie de errores propia, y garantiza que ningún path buscado de un binario ausente se
  filtre al payload.
- `render-job.ts` pasa de un tipo único a una **unión discriminada** por `kind`: `JobBase` +
  `RenderJob` / `MontageJob`, `Job`, `JobSummary` (`RenderJobSummary` queda como alias),
  `CreateJobInput = CreateRenderJobInput | CreateMontageJobInput`. Agregar un miembro a esta unión
  —o a `JsonBodyResult` en `read-json-body.ts`, que ganó la variante `'empty'`— rompe la
  exhaustividad en **todos** los call sites, incluidos handlers que la task en curso no lista.
- Cuatro puertos nuevos en `RenderApiDependencies`: `readDirectory`, `statFile` (de `auto-montage`)
  y `createCommandRunner`, `resolveMontageBinaries` (de `media-local`).
- Frontera de libs pesadas intacta: `@video-maker/media-local` sigue entrando **sólo** por
  `await import()` memoizado en `node-render-api-dependencies.ts` — ni un solo import de valor
  estático en el resto de `src/`.

## Dependencias

Ninguna dependencia npm nueva: `apps/render-api` mantiene cero dependencias propias en su
`package.json`. Lo nuevo es consumo de dos libs del workspace que ya estaban declaradas
(`@video-maker/auto-montage` estático, `@video-maker/media-local` dinámico).

## Qué sigue

- `cycle-02` de esta spec: el frontend en `apps/web` sobre este contrato (el backend está cerrado
  y estable).
- Nueve códigos reales de las libs (`TRANSCRIPTION_FAILED`, `ASSET_PROBE_FAILED`,
  `PROJECT_LAYOUT_INVALID`, `PATH_ESCAPES_PROJECT`, `READ_ONLY_RAW_PATH`, `COMMAND_FAILED`,
  `UNPARSEABLE_OUTPUT`, `UNRESOLVED_AUDIO_ASSET`, `MISSING_MEDIA_STREAM`) caen hoy al catch-all
  `MONTAGE_FAILED` (500). Ninguno se dispara en los flujos de este ciclo —`ingestProject` acumula
  las fallas de probe y transcripción en su `IngestResult` en vez de lanzarlas—; darles código
  propio es decisión de arquitectura de un ciclo futuro.
- La cola sigue **in-memory, concurrencia 1 y sin persistencia entre reinicios**, ahora para los
  dos tipos de job.
