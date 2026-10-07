# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
Modo motion: `POST /projects {slug, mode}` (default footage; motion crea `motion/`), `mode` en lista y
detalle, `GET /motion/brands`, `GET/PUT /projects/:slug/motion/{brief,storyboard}` validados con la lib
(`BRIEF_INVALID`, `BRAND_NOT_FOUND`, `STORYBOARD_INVALID`, 409 `MOTION_PROJECT_REQUIRED`) y job
`motion` (fases storyboard | video | all; etapas storyboard/voice/plan/compose/render; misma cola que
render). Verificado de punta a punta desde la web: reel 9:16 de 47 s. Los procesos hijos ya no reciben
`ANTHROPIC_API_KEY` (el CLI de Claude usa la suscripción); el error del agente llega al job con su
`subtype`/`result`.

## Estructura
`jobs/{run-motion-pipeline,motion-job-params,motion-job-progress,motion-pipeline-observer}.ts`,
`deps/{motion-pipeline-adapters,hyperframes-cli}.ts`, `errors/translate-motion-error.ts`,
`http/handlers/motion-handler.ts`. Trabajo en `<proyecto>/work/motion/`, salida `out/<output>`.

## Dependencias
`@video-maker/motion-graphics` (alias en vite y tsconfig), `hyperframes@0.8.139` (raíz; corre con
`process.execPath` + `ELECTRON_RUN_AS_NODE` bajo Electron). Env: `MOTION_GRAPHICS_ASSETS`,
`HYPERFRAMES_RESOLVE_FROM`.

## Qué sigue
El progreso del job queda en 80 % al terminar la fase video; mostrar 100 al cerrar. Con un `.env` con
`ANTHROPIC_API_KEY` inválida el CLI reintentaba 3 min antes del 401: ya no aplica.
