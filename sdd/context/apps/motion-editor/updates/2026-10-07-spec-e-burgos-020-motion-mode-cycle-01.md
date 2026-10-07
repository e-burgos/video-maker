# spec-e-burgos-020-motion-mode cycle-01 — 2026-10-07

## Estado
App mudada desde `display-ads/apps/video-manager` con sus tres videos ("Cómo funciona DisplayAds" 2:00,
"Conectá tu Core Pro" 1:12, "Conectá tu Mostrador" 1:12), editor, motor vendorizado, guías y 62 tests.

## Estructura
Igual que en display-ads; renombre técnico `video-manager` → `motion-editor` (proyecto, rutas, endpoint
dev-only `/__motion-editor/save-timeline`). Targets explícitos en `project.json` (el workspace no infiere).
`eslint.config.mjs` propio: habilita JSX y no reporta los `eslint-disable` de los dos `.jsx` vendorizados.

## Dependencias
`mp4-muxer` 5.2 en la raíz (export a MP4). Sin dependencias de libs del workspace.

## Qué sigue
- El test `save-timeline-core.spec.ts` "caso inválido" pasaba en display-ads sin probar nada (la fila llegaba
  como objeto suelto y cualquier cosa daba 422); ahora cada caso es una lista real.
- El export de este editor es mudo: la voz, la música y los cortes al golpe viven en `libs/motion-graphics` (cycle-02).
