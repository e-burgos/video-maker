# Constitución — apps/motion-editor

> Versión 1.0 | Última actualización: creación (mudanza desde display-ads/apps/video-manager) | Fecha: 2026-10-07
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-020-motion-mode`.

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
