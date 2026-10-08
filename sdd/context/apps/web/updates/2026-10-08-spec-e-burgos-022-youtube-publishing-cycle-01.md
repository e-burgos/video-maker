# spec-e-burgos-022-youtube-publishing cycle-01 — 2026-10-08

## Estado
Configuración › YouTube (credencial del cliente, conectar con sondeo, desconectar) y diálogo "Publicar en YouTube" en
vista previa (material crudo y motion) y Entregas: borrador del productor, contadores, visibilidad, programación,
lista, miniatura, confirmación con el nombre del canal al publicar público, progreso por bytes, enlace y reintento.
Panel de publicaciones del proyecto e insignia en la tarjeta del video.

## Estructura
Nuevos `components/youtube-*.tsx`, `publications-panel.tsx`, hooks `use-youtube-integration`,
`use-youtube-connect-flow`, `api/youtube-*.ts`, `publication-status.ts`; sección `youtube` en la guía.

## Dependencias
Sin cambios.

## Qué sigue
cycle-02: cola de publicación.
