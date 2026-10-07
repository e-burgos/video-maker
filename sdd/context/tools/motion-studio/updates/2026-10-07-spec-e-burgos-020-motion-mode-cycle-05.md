# spec-e-burgos-020-motion-mode cycle-05 — 2026-10-07

## Estado
La skill `video-maker-material-contract` cubre los dos modos: §0 elige material crudo (A) o motion
graphics (B) y §12 documenta el modo B (layout `motion/brief.json` + `raw/images/`, campos del brief,
reglas del guion, checklist, entrega por HTTP con el job `motion` y por esta CLI, tabla de errores).
display-ads la consume por symlink y suma su skill `video-maker-request` (FIX-e-burgos-332, rama
`feat/video-maker-modes`), que decide el modo por video; `apps/video-manager` salió de display-ads.

## Estructura
Sin cambios en el código de la tool.

## Dependencias
Sin cambios.

## Qué sigue
Producir los videos pendientes de display-ads con la skill nueva (promos y reels en modo B).
