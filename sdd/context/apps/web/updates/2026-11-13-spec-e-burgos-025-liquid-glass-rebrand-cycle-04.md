# apps/web — spec-e-burgos-025-liquid-glass-rebrand cycle-04 (2026-11-13)

## Estado
Vista previa y render, motion (brief, storyboard, voz y vista previa) y marcas (listado y editor) migrados al Cristal Líquido; `/projects/:slug/preview`, `/projects/:slug/motion`, `/brands` y `/brands/:id` entran en `isMigratedRoute`. `LegacySurface` ya no se usa (el archivo sigue, a la espera de borrarlo).

## Estructura
- `components/preview/`: ajustes de render en secciones plegables (`Collapse` unstyled, una abierta a la vez) con resumen, acción de render e historial (`renderJobTone`).
- `components/motion/`: piezas del brief y del video entregado.
- `components/brands/`: tarjetas, secciones del editor, vista previa y barra de guardado única. Los borradores de sección viven en la página (`use-brand-draft`, `brand-draft.ts`) y un solo `putBrand` aplica las secciones cambiadas; colores, variables avanzadas y archivos se aplican al instante.
- `hooks/use-section-draft.ts` se reinicia en el mismo render (sin parpadeo de «sin guardar» al cargar).
- `components/ui/cl-controls.ts`: `PANEL_CLASS`, `PANEL_HEADING_CLASS`, `OPAQUE_MEDIA_FRAME_CLASS`, `TOOLBAR_SECONDARY_BUTTON_CLASS`, `CHECKBOX_CLASS`, `ROW_CLASS`.
- `timeline-player` lleva `data-media`: la auditoría de contraste ignora sus controles.

## Dependencias
Sin cambios de dependencias ni de API.

## Qué sigue
Ciclo 05: publicación, ajustes, guía, `RenderReviewPanel`, `YouTubePublishDialog` y retiro del modo heredado de `surface`. `studio-layout.spec` usa `/publish-queue` como ruta no migrada.
