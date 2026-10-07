# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
Pipeline detrás de `MotionPipelinePorts` (`composeFromStoryboard`, `autoStoryboard`, `voiceProject` con
`onLine`, `planProject`, `composeProject`, `renderProject`, `initFromTemplate`): lo usan la CLI y el
job `motion` de render-api. `hyperframesInvocation` arma comando y entorno sin `node:*`. En 9:16 las
escenas se centran en vertical y las mini pantallas de `remote-update` llevan el chip debajo.

## Estructura
`src/pipeline/{ports,join-path,project-files,hyperframes-invocation,...}.ts` + `__fixtures__`; brief de
reel en `assets/briefs/displayads/plataforma-reel.json`.

## Dependencias
Sin cambios (la lib sigue sin `node:*`).

## Qué sigue
`MotionStudioError` admite `cause`: render-api la usa para mostrar el error real del agente.

## FIX-e-burgos-003 (2026-10-07)
`BrandManifest` suma por equipo `retired`, `plate` y `spokenName`, y las imágenes aceptan `{file, caption}`
(helpers `brandImageFile`, `brandImageCaption`, `activeDeviceIds`). Kit DisplayAds: Easy Pro reemplaza a
Core Pro (retirado; su storyboard en `storyboards/displayads/archivo/`), 19 fotos aprobadas con
descripción en `img/scenes/`, tagline "Tus pantallas, bajo control.".
