# spec-e-burgos-025-liquid-glass-rebrand — cycle-05 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web, apps/docs-site | Fecha: 2026-11-13
> Objetivo: publicación, ajustes en pestañas (Productor, Voz, YouTube, Apariencia), guía, modales y estados vacío/carga/error migrados; retiro del modo heredado (`surface="legacy"`, superficie oscura de rutas no migradas y `LegacySurface`); capturas del studio nuevo en la web pública.
> Fuera de alcance: paridad con la web (ciclo 06); rediseño de `apps/docs-site` (solo se reemplazan capturas); cambios de API.
> Referencias visuales: `design/rebranding/vistas/publicacion-*.png`, `ajustes-*.png`, `guia-*.png`, `chat-*.png`.

## Pendientes del ciclo 04
- `components/shell/legacy-surface.tsx` sin usos y sin borrar (bloqueo de permisos): se retira en TASK-003 junto con el modo heredado.
- e2e de los ciclos 03 y 04 sin correr: se corren en TASK-005 si el studio está libre.

## Historias
- US-025-501 — Como usuario quiero ver y operar la cola de publicación con claridad. CA: página de publicación con estado de la cola (pausada/activa) y acción principal en el toolbar; ítems con StateBadge, miniatura opaca y acciones; `RenderReviewPanel` y `YouTubePublishDialog` migrados a vidrio con medios opacos.
- US-025-502 — Como usuario quiero ajustar el studio desde un solo lugar ordenado. CA: ajustes en pestañas Productor, Voz, YouTube y Apariencia; Apariencia (tema y material) sale del pie de la barra lateral y queda en ajustes, con un acceso directo desde el pie; guardado claro por pestaña.
- US-025-503 — Como usuario quiero una guía que se lea bien. CA: guía migrada con índice lateral, pasos y bloques de código legibles en claro y oscuro.
- US-025-504 — Como usuario quiero modales y estados coherentes. CA: todos los modales con `surface="glass"` como único modo; estados vacío, carga y error con un patrón común; sin superficie oscura heredada en ninguna ruta.
- US-025-505 — Como visitante de la web quiero ver cómo es el studio hoy. CA: capturas de `apps/docs-site/public/screenshots/` del productor, material, motion, inicio y ajustes regeneradas con el diseño nuevo; la web no cambia de diseño.

## Tasks (detalle en tasks.json)
- TASK-001 — Publicación: `publish-queue-page`, `publications-panel`, `RenderReviewPanel`, `YouTubePublishDialog` y piezas `youtube-*`. Valida: specs y capturas.
- TASK-002 — Ajustes y guía: `settings-page` en pestañas, Apariencia movida, `guide-page`. Valida: specs y capturas.
- TASK-003 — Modales, estados y retiro del modo heredado: `surface` solo glass, `ErrorNotice` y estados comunes, `isMigratedRoute` y la superficie heredada eliminados, `legacy-surface.tsx` borrado. Valida: specs y barrido de rutas.
- TASK-004 — Capturas de la web: `apps/docs-site/scripts/capture-screenshots.mjs` actualizado a los selectores nuevos y capturas regeneradas. Valida: build y check-links de docs-site.
- TASK-005 — Verificación del ciclo: `contrast-audit.mjs` sobre todas las rutas en claro y oscuro, e2e si el studio está libre, cierre.

## Decisiones técnicas
- Sin cambios de `schema.json`, `api.json` ni `components.json`.
- TASK-001, TASK-002 y TASK-003 en serie (comparten i18n y `shell-content`); TASK-004 al final porque captura las pantallas ya migradas.
- Si `capture-screenshots.mjs` necesita un studio, usa un vite temporal contra el render-api del studio en marcha, sin escribir datos.
