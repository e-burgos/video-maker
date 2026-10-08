# spec-e-burgos-021-brand-kit cycle-02 — 2026-10-08

## Estado
`POST /brands/:id/preview` compone apertura y cierre con timeline sintético en `<brandsRoot>/.preview/<id>/`, serializado
por marca en `runtime.brandPreviewSerializer`; el HTML de vista previa fija el lienzo 1920×1080 escalado a la ventana
(fuera del reproductor de HyperFrames `html/body` no tienen alto). `POST /brands/:id/fonts` baja Google Fonts por
`deps.fetchRemote` (sólo fonts.googleapis.com / fonts.gstatic.com). Errores `BRAND_FONT_UNKNOWN` (422) y
`BRAND_FONT_DOWNLOAD_FAILED` (502).

## Estructura
`src/brands/brand-preview.ts`, `brand-fonts.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
