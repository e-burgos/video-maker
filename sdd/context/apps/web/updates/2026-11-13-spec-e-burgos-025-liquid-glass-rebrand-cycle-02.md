# spec-e-burgos-025-liquid-glass-rebrand cycle-02 — 2026-11-13

## Estado
- Migradas al Cristal Líquido (fuera de la superficie heredada): Mis videos (`/`) y el espacio de trabajo del video (`/projects/:slug` exacto). Las subrutas del video siguen heredadas.
- Los pasos del video en la sidebar muestran estado real (`useVideoStepStatuses`).
- Espacio de trabajo: chat del productor y primer uso a la izquierda; vista previa siempre visible sobre escenario opaco y Material | Entregas a la derecha; estado de la propuesta en el slot de estado del toolbar y «Aprobar el enfoque recomendado» como acción solo con propuesta pendiente.

## Estructura
- `components/shell/use-video-step-statuses.ts`, `toolbar-status.tsx` y `toolbar-status-context.ts`.
- `components/videos/*` (Mis videos), `components/workspace/*` (vista previa, Material, Entregas), `components/ui/overflow-menu` y `components/ui/cl-controls` (botones del lenguaje nuevo), `api/video-filter`.
- Patrón `surface="glass"` en `Modal`, `ErrorNotice` y `BrandPicker`: por defecto conservan el estilo heredado para las pantallas viejas; las migradas piden vidrio. `Modal` va por portal al `body` (un ancestro con `backdrop-filter` atrapa el `position: fixed`).
- `TimelinePlayer` con modo `fit`.
- Tokens nuevos: `--cl-action-fill` y `--cl-action-fill-hover` (relleno de botones primarios y burbuja del usuario con texto blanco; en oscuro `#1f6feb`, ≈ 4,6:1) y `--tucu-segmented-fg: var(--cl-ink-2)` (texto inactivo de los segmentados de tucu-ui, que quedaba en 3,95:1).
- Tonos de estado del video para todo el studio: publicado verde, video listo teal, sin material naranja, montaje listo púrpura, material cargado y archivado neutros.
- Auditoría reutilizable `design/rebranding/contrast-audit.mjs <dir> <rutas…>`: mide cada texto visible contra el fondo renderizado y el desborde horizontal.

## Qué sigue
- `RenderReviewPanel` (en Entregas, envuelto en una isla oscura) y `YouTubePublishDialog` siguen con estilo heredado: limpiar en el ciclo 05 junto con el modo heredado de `surface`.
- No hay API para renombrar videos: solo se renombran carpetas.
