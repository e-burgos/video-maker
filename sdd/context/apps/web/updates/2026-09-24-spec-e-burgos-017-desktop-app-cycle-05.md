# spec-e-burgos-017-desktop-app cycle-05 — 2026-09-24

## Estado
La interfaz pasó a ser centrada en el chat. `/projects/:slug` es un espacio de trabajo único: la conversación del
productor a la izquierda (con el cuadro de texto fijo abajo) y un panel con pestañas Vista previa, Material y
Entregas que cambian solas cuando termina un montaje o un render. Las pantallas anteriores (biblioteca,
storyboard, voz, vista previa y edición) siguen como "Edición avanzada". Los archivos se arrastran al chat o se
adjuntan con un botón; cada uno muestra una tarjeta con la propuesta de rol y su razón, y pasa a su carpeta al
confirmar. El inicio ("Tus videos") tiene tarjetas con miniatura, un solo estado en lenguaje de usuario y una zona
para crear un video soltando un archivo. Carga inicial real: 294 kB.

## Estructura
- `pages/project-workspace-page.tsx`, `components/workspace-side-panel.tsx`, `components/producer-conversation-panel.tsx`
  (la lógica del chat vive en `hooks/use-producer-conversation.ts`), `components/chat-drop-zone.tsx`,
  `components/asset-proposal-card.tsx` (las tarjetas pendientes van en una pila fija arriba del cuadro de texto),
  `hooks/use-inbox-uploads.ts`, `hooks/use-stick-to-bottom.ts` (solo con mensajes), `hooks/use-auto-switching-tab.ts`.
- `components/ui/{button,card,badge,tabs}.tsx` y tokens en `index.css` (`@theme`: surface, border, ink, accent…).
- Inicio: `video-card.tsx`, `home-drop-hint.tsx`, `create-project-by-drop.tsx`, `api/project-status.ts`,
  `hooks/use-video-card-thumbnail.ts`. En la interfaz, "video" es un proyecto de la API y "carpeta" es un folder.
- Traducciones cargadas de forma perezosa; los tests precargan el inglés en `test-setup.ts`.
- `vite.config.ts` fuerza `NODE_ENV=production` en `build`: el `.env` raíz trae `NODE_ENV=development`, Nx lo inyecta
  en todas las tasks y el build salía con React de desarrollo.
- `api/voice-i18n.ts` describe las voces con `Intl.DisplayNames`; la salud agrupa los binarios en herramientas de
  video, transcripción y motor de voz.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Quedan en inglés o con 404 esperables algunas superficies de edición avanzada (input de archivos del storyboard,
documentos todavía no creados).
