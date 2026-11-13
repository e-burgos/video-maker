# spec-e-burgos-025-liquid-glass-rebrand — cycle-01 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web, apps/desktop | Fecha: 2026-11-13
> Objetivo: base visual Cristal Líquido montada sobre tucu-ui, tema claro/oscuro/sistema y shell nuevo (sidebar, toolbar con una acción por ruta) dentro de la ventana de Electron, conviviendo con las pantallas que todavía no migraron.
> Fuera de alcance: rediseño de cada pantalla (ciclos 02 a 05), funciones nuevas de la web (ciclo 06), `apps/docs-site`, `apps/motion-editor`.

## Historias
- US-025-101 — Como dev quiero tucu-ui montado con Tailwind propio y los tokens del contrato para construir pantallas con vidrio sin romper las actuales. CA: `pnpm nx run-many -t lint test build -p web` en verde; las pantallas no migradas se ven igual que antes; sin errores en consola.
- US-025-102 — Como usuario quiero elegir tema sistema, claro u oscuro y materiales vidrio o sólidos. CA: la preferencia persiste, sigue al sistema por defecto, `prefers-reduced-transparency` apaga el blur y `prefers-contrast: more` marca los bordes.
- US-025-103 — Como usuario quiero una sidebar con Mis videos, Marcas, Publicación, Ajustes y Guía, y los pasos del video abierto con su estado. CA: el bloque del video aparece solo dentro de `/projects/:slug`; navegable por teclado; colapsa bajo 1100 px.
- US-025-104 — Como usuario quiero un toolbar con una sola acción principal que cambia según la pantalla. CA: una página declara su acción y su estado; sin declarar, el toolbar solo muestra el título; verificado con un spec del layout.
- US-025-105 — Como usuario de la app de escritorio quiero una ventana con tamaño mínimo, botones de ventana sobre la sidebar y sin destello al abrir. CA: `minWidth`/`minHeight` fijados, zona de arrastre en el toolbar sin romper clics, color de fondo según el tema, ícono declarado.

- US-025-106 — Como dueño del producto quiero un logo nuevo de Video Maker, trabajado conmigo, para que el rediseño tenga identidad propia. CA: marca (isotipo), wordmark y versión compacta en SVG; ícono de la app (macOS) en PNG y `.icns`; favicon; legibles a 16 px y en light y dark; aplicados en la sidebar y en la ventana de Electron.

## Tasks (detalle en tasks.json)
- TASK-007 — Logo nuevo: exploración de conceptos con el dev en `design/rebranding/logo/`, elección y refinamiento; entregables SVG, PNG, `.icns` y favicon; componente `BrandMark` en el studio. Valida: revisión visual con el dev a 16, 28 y 128 px en light y dark.
- TASK-001 — Spike y montaje de tucu-ui: dependencia 3.10.1, `@import` del tema y `@source` en `index.css`, prueba de `GlassPanel`, `SegmentedControl`, `StateBadge`, `Button`, `Modal` y `Collapse` con y sin `ThemeProvider`; si hace falta, `ThemeProvider` mínimo manteniendo `BrowserRouter`. Resuelve también el slot de acción del toolbar por ruta y el bloque anidado de la sidebar. Valida: build de `web` y spec del montaje.
- TASK-002 — Tokens y escena: variables `--tucu-*` y `--cl-*` en `:root` y `.dark`, utilidades `glass`, `glass-thin`, `glass-thick`, `glass-sub`, `focus-cl`, escena aurora estática, Inter y JetBrains Mono empaquetadas (con su aviso de licencia). Valida: captura de la escena en light y dark.
- TASK-003 — Tema y materiales: contexto de tema (sistema/claro/oscuro), selector, persistencia, `data-material="solid"`, reglas de `prefers-reduced-transparency` y `prefers-contrast`, aplicado sin destello antes del primer render. Valida: specs del contexto y del selector.
- TASK-004 — Shell: `StudioLayout` nuevo con sidebar de vidrio, bloque «este video» con pasos y estado, toolbar con título y acción por ruta (hook para que cada página declare su acción), foot con estado del servicio e idioma, colapso responsive. Las páginas actuales siguen renderizando dentro. Valida: specs del layout, de la sidebar y del hook; `workspace-smoke` y `studio-smoke`.
- TASK-005 — Electron: `minWidth`/`minHeight`, `titleBarStyle` con los botones sobre la sidebar, zona de arrastre, `backgroundColor` según tema, ícono, y ventana de configuración inicial con el mismo fondo y botón de acción. Valida: specs del main de desktop y prueba en la app real.
- TASK-006 — Verificación del ciclo: capturas antes/después de todas las pantallas dentro del shell nuevo (light y dark), contraste AA medido, `prefers-reduced-*` emulados, costo de blur medido en Mis videos. Evidencia en `artifacts/`.

## Decisiones técnicas
- Sin `schema.json`, `api.json` ni `components.json`: el ciclo no crea tablas, endpoints ni contratos que otro subproyecto consuma. El único contrato nuevo es el visual, que queda escrito en `index.css` y en el fragmento de contexto de `apps/web` al cerrar.
- El resultado del spike se registra aquí al terminar TASK-001: qué componentes funcionaron sin `ThemeProvider`, qué slot se usó para la acción del toolbar y si la sidebar admite el bloque anidado.
- Las pantallas viejas conviven con los tokens actuales (`surface`, `ink`, `accent`) hasta su ciclo; el modo claro se habilita por pantalla migrada, así que hasta entonces esas pantallas se muestran en oscuro dentro del shell nuevo.

## Resultado del spike (TASK-001, commit 28cdab0)
- tucu-ui 3.10.1 va en el `package.json` raíz (no hay `package.json` en `apps/web`). Montaje: `@import '@e-burgos/tucu-ui/theme'` y `@source '../../../node_modules/@e-burgos/tucu-ui/**/*.mjs'` después de `@import 'tailwindcss'`; nunca `/styles`.
- `GlassPanel`, `SegmentedControl`, `StateBadge`, `Button`, `Modal` y `Collapse` funcionan sin `ThemeProvider` y dentro de `ThemeScope` (`useTheme` es un store, no un contexto). Se conserva el `BrowserRouter` propio; no hace falta `ThemeProvider`. Evidencia: `apps/web/src/theme/tucu-mount.spec.tsx`.
- El layout Tahoe no sirve tal cual: `rightButton` es un único nodo estático, el panel y el fondo son fijos y la sidebar no admite un bloque anidado. Decisión para TASK-004: shell y sidebar propios (`MacOSSidebar` suelto admite `header`, `footer` y `sections`) y toolbar con `MacOSToolbarTahoe` (`title`, `leading`, `center`, `trailing`) alimentado por un contexto de acción que cada página declara con un hook.
- El tema cambiaba `font-sans` a Inter, `font-mono` a JetBrains Mono y activaba `antialiased`; se neutralizó en `index.css` (fuentes fijas a los stacks anteriores) para que las pantallas no migradas no cambien. TASK-002 reemplaza esos valores por las fuentes nuevas cuando estén empaquetadas.
- Los tokens propios `--color-accent`, `--color-warning` y `--color-success` pisan a los de tucu-ui porque el `@theme` propio va después del import.

## Logo (TASK-007)
- Elegido con el dev: concepto E «V dentro de la lente» en paleta coral a violeta (`#ff5470` a `#7c5cff`), con la firma «by Esteban Burgos» en los lockups (nunca en el ícono ni en el favicon). Nombre en Outfit 600/400 convertido a trazos.
- Generador reproducible: `design/rebranding/logo/build-logo.mjs` produce `final/` (marca, glifo monocromo, ícono de app, lockups horizontal y vertical en claro y oscuro, PNG y `.icns`), el favicon del studio, `apps/desktop/build/icon.icns` y `icon.png`, y el componente `apps/web/src/components/ui/brand-mark.tsx`.
- El componente vive en `components/ui/` porque el escáner de textos literales (`no-literal-copy.spec.ts`) confunde los genéricos de TypeScript con texto JSX en `components/*.tsx`; las etiquetas llegan por prop desde el catálogo (`brand.name`, `brand.nameWithSignature`).
- Pendiente: cableado de `icon` en `electron-builder.yml` (TASK-005) y uso de `BrandMark`/`BrandWordmark` en la sidebar (TASK-004). La adopción en la web pública sigue pendiente de decisión del dev (D-15).
