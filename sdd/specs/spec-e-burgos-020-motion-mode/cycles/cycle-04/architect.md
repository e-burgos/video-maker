# Architect — Cycle 4: Motion Mode (studio-motion)

> **Input:** functional.md · **Generado por:** sdd-architect (actor único)

## 0. Resumen

```
web (crear proyecto: mode) ──POST /projects──▶ render-api ──▶ local-store projects.mode (v4)
web (página Motion) ──PUT brief──▶ <proyecto>/motion/brief.json        imágenes: raw/images/ (upload existente)
                    ──POST jobs {kind: motion, phase}──▶ cola de jobs ──▶ runMotionPipeline (render-api)
                                                                         │  usa libs/motion-graphics/pipeline
                                                                         ├─ storyboard: generateMotionStoryboard (AiAgentPort efectivo)
                                                                         ├─ voice: Piper + whisper (media-local)
                                                                         ├─ plan / compose: lib pura
                                                                         └─ render: HyperFrames CLI instalada
productor ──start_job {kind: motion}──▶ mismo endpoint
```

## 1. Pipeline en la lib — `libs/motion-graphics/src/pipeline/`

`MotionPipelinePorts` (sin `node:*`): `readText`, `writeText`, `readBytes`, `exists`, `copyFile`,
`copyTree`, `removeFile`, `synthesize`, `transcribe`, `detectBeats`, `trimAudio`, `render`, `askAgent`,
`assetsRoot`. Pasos exportados (hoy funciones privadas de `tools/motion-studio/src/cli.ts`):
`composeFromStoryboard`, `autoStoryboard`, `voiceProject(ports, project, {takes, only?, onLine?})`,
`planProject(ports, project, {beatSync})`, `composeProject`, `renderProject`. Cada paso devuelve sus
líneas de reporte y datos (`{lines, ...}`). La CLI pasa a ser `parseArgs` + llamada al paso.

HyperFrames sin npx: `hyperframes@0.8.139` como dependencia del workspace; `resolveHyperframesCli()`
devuelve `{command, args, env}`: `process.execPath` + `require.resolve('hyperframes/dist/cli.js')` y, bajo
Electron (`process.versions.electron`), `ELECTRON_RUN_AS_NODE=1`. Siempre `HYPERFRAMES_NO_UPDATE_CHECK=1`,
`HYPERFRAMES_NO_TELEMETRY=1`, `HYPERFRAMES_NO_AUTO_INSTALL=1`, y `PRODUCER_HEADLESS_SHELL_PATH` desde
`REMOTION_BROWSER_EXECUTABLE` si está.

## 2. local-store — migración v4

`ALTER TABLE projects ADD COLUMN mode TEXT NOT NULL DEFAULT 'footage'`. `ProjectMode = 'footage' |
'motion'`; `ProjectRecord.mode`; `insert(slug, importedAt?, mode = 'footage')`. La importación de carpetas
detecta `motion/brief.json` → `motion`.

## 3. render-api — HTTP

| Método | Ruta | Cuerpo / respuesta |
| --- | --- | --- |
| POST | `/projects` | `{slug, mode?: 'footage'\|'motion'}` → proyecto con `mode`; motion crea además `motion/` |
| GET | `/projects`, `/projects/:slug` | agregan `mode` |
| GET | `/motion/brands` | `[{id, name, formats: ['16:9','9:16'], music: [{id, mood, bpm, hasDrop}]}]` |
| GET/PUT | `/projects/:slug/motion/brief` | `MotionBrief` (PUT valida con `parseMotionBrief`; 400 `BRIEF_INVALID` con el campo) |
| GET/PUT | `/projects/:slug/motion/storyboard` | `MotionStoryboard` (404 si no hay; PUT valida con el parser) |

`brief.images[].file` es un nombre de `raw/images/`; el job copia esas imágenes a `work/motion/images/`.
Errores nuevos: `MOTION_PROJECT_REQUIRED` (409, ruta motion sobre un proyecto footage), `BRIEF_INVALID`,
`STORYBOARD_INVALID`, `BRAND_NOT_FOUND`.

## 4. render-api — job `motion`

`POST /projects/:slug/jobs {kind: 'motion', phase?: 'storyboard'|'video'|'all' (default 'all'), output?:
'video.mp4', takes?: 1..8 (default 5), overwrite?: boolean}`.

- Directorio de trabajo `work/motion/` (proyecto HyperFrames). `phase: storyboard` corre `autoStoryboard`
  y escribe `motion/storyboard.json`; `video` exige storyboard (409 `STORYBOARD_MISSING`) y corre
  `composeFromStoryboard` → `voiceProject` → `planProject` → `composeProject` → `renderProject` a
  `out/<output>`; `all` encadena.
- Etapas de progreso: `storyboard | voice | plan | compose | render`, con `linesVoiced/totalLines`.
- Reporte: `{path, durationSec, scenes, storyboard: {repaired, tokensIn, tokensOut, costUsd} | null}`.
- Adaptadores (`deps/motion-pipeline-adapters.ts`): `askAgent` mapea el `AiAgentPort` efectivo
  (`tokensIn/tokensOut/costUsd` ↔ `inputTokens/outputTokens/costUsd`); `synthesize/transcribe` usan las
  deps de voz ya existentes; `detectBeats/render` usan `resolveHyperframesCli()`; `trimAudio` usa ffmpeg.
- `MOTION_GRAPHICS_ASSETS` (default `libs/motion-graphics/assets` del repo) para runtime y marcas.
- Alias `@video-maker/motion-graphics` en `apps/render-api/vite.config.ts` (y en el bundle de desktop).

## 5. apps/web

- `CreateProjectForm`: dos opciones grandes (Motion graphics / Material crudo), default material crudo.
- Lista: insignia del modo. Proyecto motion → `/projects/:slug/motion`.
- `MotionPage`: formulario del brief (marca de `/motion/brands`, formato, música, golpes, objetivo,
  público, guion, imágenes de `raw/images/` con su descripción; subida con el `AssetUploader` existente),
  botones "Armar storyboard" y "Hacer video" (job motion), lista de escenas (tipo + voz) con el costo,
  panel de progreso como `RenderJobPanel` y reproductor del MP4. Textos en es/en con el i18n existente.

## 6. Productor

`start_job` acepta `{kind: 'motion', phase?, output?, takes?}`; `get_project_overview` agrega `mode`;
`build-producer-prompt` suma la receta motion (escribir `motion/brief.json` con `write_project_text`,
fase storyboard, resumir escenas, fase video) y la usa cuando el proyecto es motion.

## 7. Desktop

`build-desktop.mjs`: `hyperframes: 0.8.139` en `RENDER_API_RUNTIME_DEPS` (con sus nativos `sharp` y
`onnxruntime-node` permitidos en el install); `extraResources` copia `libs/motion-graphics/assets` a
`motion-assets`; `render-api-env.ts` setea `MOTION_GRAPHICS_ASSETS` y `PRODUCER_HEADLESS_SHELL_PATH`.
Verificación con la app instalada (memoria `installed-app-test-setup`).

## 8. Riesgos

- Nativos de HyperFrames (`sharp`, `onnxruntime-node`) dentro del asar: van en `render-api/node_modules`
  fuera del asar como los de remotion; si `onnxruntime-node` no carga, `beats` cae → `plan --no-beat-sync`
  como degradación explícita con aviso.
- Un render motion dura ~2,5 min por minuto de video y la voz ~30 s por línea: el job reporta etapa y
  línea para que no parezca colgado.
