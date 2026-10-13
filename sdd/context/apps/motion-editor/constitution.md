# Constitución — apps/motion-editor

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** app React 19 + Vite (SPA local de autoría)
- **Rol:** editor visual de videos explicativos animados por timeline (1920×1080): un video = una carpeta en
  `src/videos/<slug>/` con `video.ts`, `timeline.json`, escenas y guion de locución; retiming en el editor y
  export frame por frame desde el navegador. Origen: `display-ads/apps/video-manager` (ciclos 33 y 73 de display-ads).

## 2. Stack

- React 19, Vite 8, Vitest 4 (jsdom). Estilos inline, sin Tailwind ni librerías de UI.
- Motor de timeline vendorizado (`src/engine/animations-v2.jsx`, no editar) detrás de la fachada tipada `src/engine/api.ts`.

## 3. Reglas (detalle en `SKILLS/VIDEO-CREATOR.md` y `SKILLS/MOTION-EDITOR.md`)

- Cada frame se calcula solo a partir del tiempo: nada de `useState` + timers, transiciones CSS ni `requestAnimationFrame` propios.
- Importar el motor siempre desde `src/engine/api.ts`; nunca editar los `.jsx` vendorizados.
- Descubrimiento de videos por convención (`import.meta.glob`): no hay registro central.
- Sin `package.json` propio: las dependencias viven en la raíz del workspace.

## 4. Estado y estructura

- Trae tres videos ("Cómo funciona DisplayAds" 2:00, "Conectá tu Core Pro" 1:12, "Conectá tu Mostrador" 1:12), editor,
  motor vendorizado, guías y 62 tests.
- Renombre técnico `video-manager` → `motion-editor` (proyecto, rutas, endpoint dev-only `/__motion-editor/save-timeline`).
  Targets explícitos en `project.json` (el workspace no infiere). `eslint.config.mjs` propio: habilita JSX y no
  reporta los `eslint-disable` de los dos `.jsx` vendorizados.
- Dependencia: `mp4-muxer` 5.2 en la raíz (export a MP4). Sin dependencias de libs del workspace.
- El export de este editor es mudo: la voz, la música y los cortes al golpe viven en `libs/motion-graphics`.
