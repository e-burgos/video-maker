# spec-e-burgos-025-liquid-glass-rebrand — cycle-04 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web | Fecha: 2026-11-13
> Objetivo: vista previa y render con ajustes plegables, motion (brief y storyboard motion) y marcas (listado y editor con guardado único) migrados al Cristal Líquido; se retira `LegacySurface`.
> Fuera de alcance: publicación, ajustes, guía, `RenderReviewPanel`, `YouTubePublishDialog` y retiro del modo heredado de `surface` (ciclo 05); cambios de API.
> Referencias visuales: `design/rebranding/vistas/render-*.png`, `motion-*.png`, `marcas-*.png`, `marca-editor-*.png`.

## Pendientes del ciclo 03
- El modo motion de storyboard y voz vive en `LegacySurface`: se migra acá y el componente se borra.
- `studio-layout.spec` usa `/preview` como ruta no migrada: pasa a `/publish-queue`.
- e2e con selectores nuevos sin correr (borrar material, montaje, storyboard, i18n): se corren en la verificación si el studio está libre.

## Historias
- US-025-401 — Como usuario quiero revisar el video y renderizarlo sin perderme en opciones. CA: «Renderizar» como acción del toolbar con su estado; reproductor opaco grande; ajustes de render agrupados en secciones plegables con resumen de lo elegido; historial de renders con StateBadge y descarga.
- US-025-402 — Como usuario quiero trabajar el video motion con el mismo lenguaje visual. CA: página motion con brief y storyboard motion migrados; modos motion de storyboard y voz sin `LegacySurface`; acción principal en el toolbar.
- US-025-403 — Como usuario quiero ver mis marcas y editarlas con un único guardado. CA: listado de marcas como tarjetas `glass-sub` con logo sobre superficie opaca y acción «Nueva marca» en el toolbar; editor con secciones (identidad, colores, tipografía, voz, música, archivos) y barra pegajosa de guardado único con «cambios sin guardar».

## Tasks (detalle en tasks.json)
- TASK-001 — Vista previa y render: `project-preview-page` y sus componentes, ruta en `isMigratedRoute`. Valida: specs y capturas.
- TASK-002 — Motion: `motion-page` y los modos motion de storyboard y voz; borrar `components/shell/legacy-surface.tsx`. Valida: specs y capturas.
- TASK-003 — Marcas: `brands-page` y `brand-editor-page` con guardado único; rutas en `isMigratedRoute`. Valida: specs y capturas.
- TASK-004 — Verificación del ciclo: `contrast-audit.mjs` en claro y oscuro sobre las cinco pantallas (0 fallas, sin desborde), capturas y cierre.

## Decisiones técnicas
- Sin cambios de `schema.json`, `api.json` ni `components.json`.
- TASK-001 y TASK-002 en un subagente; TASK-003 en otro, en serie (comparten los catálogos de i18n).
- La barra pegajosa de guardado reutiliza el patrón de `storyboard-save-bar`; si hace falta, se extrae a `components/ui/`.
