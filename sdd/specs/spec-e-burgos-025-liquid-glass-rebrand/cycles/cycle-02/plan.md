# spec-e-burgos-025-liquid-glass-rebrand — cycle-02 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web | Fecha: 2026-11-13
> Objetivo: Mis videos y el espacio de trabajo del video (chat del productor, vista previa y material) migrados al Cristal Líquido, con los pasos del video mostrando su estado real.
> Fuera de alcance: biblioteca, storyboard, voz, vista previa completa, motion, marcas, publicación, ajustes y guía (ciclos 03 a 05); cambios de API o de backend.
> Referencias visuales: `design/rebranding/propuesta-shell-*.png` (Mis videos), `design/rebranding/vistas/chat-*.png` y `chat-inicio-*.png` (espacio de trabajo), `design/rebranding/propuesta-workspace-*.png`.

## Historias
- US-025-201 — Como usuario quiero ver en la sidebar en qué estado está cada paso del video abierto. CA: Material, Storyboard, Voz y Vista previa muestran listo, a revisar o pendiente según los datos reales del proyecto; se actualiza al navegar y al terminar un trabajo; sin pedidos extra cuando no hay video abierto.
- US-025-202 — Como usuario quiero encontrar y abrir mis videos rápido. CA: «Nuevo video» como única acción del toolbar; buscador por título o slug; carpetas como chips filtrables; tarjetas con una sola acción principal (Abrir) y el resto en el menú ⋮; miniaturas sobre superficie opaca; sin vidrio en la grilla que scrollea; estados de carga, vacío y error con acción.
- US-025-203 — Como usuario quiero trabajar el video desde una sola pantalla. CA: chat del productor a la izquierda con mensajes, actividad del turno, propuestas, sugerencias y compositor anclado abajo, más el estado de primer uso con material, recetas y zona de arrastre; a la derecha la vista previa siempre visible sobre escenario opaco y, debajo, Material y Entregas; el estado de la propuesta en el toolbar y su acción principal si corresponde; modo motion sin romper; claro y oscuro legibles (AA medido).

## Tasks (detalle en tasks.json)
- TASK-001 — Estado de los pasos: hook `useVideoStepStatuses(slug)` que deriva el estado desde `getProject` (`layout`, `assetCounts`), y la existencia de storyboard y voz, alimentando `VideoStepsNav`; refresco al cambiar de ruta y al cerrar un trabajo. Valida: specs del hook y de la sidebar.
- TASK-002 — Mis videos: `projects-page` y sus componentes (`video-card`, `folder-heading`, formularios de carpeta y video, zona de arrastre) migrados; ruta `/` en `isMigratedRoute`. Valida: `projects-page.spec.tsx` y los specs de los componentes tocados, capturas claro/oscuro 1440 y 900.
- TASK-003 — Espacio de trabajo: `project-workspace-page`, `ProducerConversationPanel` y sus piezas, y `WorkspaceSidePanel` (vista previa arriba, Material y Entregas abajo) migrados; ruta `/projects/:slug` en `isMigratedRoute`; estado de la propuesta en el toolbar. Valida: `project-workspace-page.spec.tsx`, specs del productor y del panel, capturas.
- TASK-004 — Verificación del ciclo: `verify-cycle.mjs` con medición de desbordes en contenedores angostos, contraste AA, `prefers-reduced-*`, capturas claro/oscuro 1440 y 900, y revisión en la ventana de Electron de desarrollo con datos temporales.

## Decisiones técnicas
- Sin cambios de `schema.json`, `api.json` ni `components.json`: el ciclo solo consume endpoints existentes.
- Los medios (miniaturas, video de la vista previa, imágenes del material) van sobre superficie opaca; el vidrio solo enmarca. Listas y grillas que scrollean no llevan blur: el panel lo tiene, las tarjetas son `glass-sub` sin blur.
- La implementación va en subagentes sonnet/medium en serie (comparten los catálogos i18n); orquestación, verificación y cierre en el hilo principal.

## Resultado TASK-001 y TASK-002 (commits 33a2e40 y ea266f0)
- `useVideoStepStatuses(slug, refreshKey)` deriva el estado de los pasos (Material por rol principal del modo, Storyboard y Voz por existencia con el 404 silenciado, Vista previa por render o timeline) y se refresca por `pathname`; sin video abierto no pide nada.
- Mis videos migrado: toolbar con «Nuevo video», buscador, chips de carpeta con conteo, tarjetas `glass-sub` con una acción principal y menú ⋮. Tonos de estado del video fijados para todo el studio: publicado verde, video listo teal, sin material naranja, montaje listo púrpura, material cargado y archivado neutros.
- Patrón nuevo `surface="glass"` en `Modal`, `ErrorNotice` y `BrandPicker`: por defecto siguen con el estilo heredado (si se cambiaban globalmente, las pantallas viejas oscuras quedaban ilegibles en claro) y las pantallas migradas piden la superficie de vidrio. `Modal` se monta con portal al `body` porque un panel con blur atrapa el `position: fixed`. Al terminar la migración (ciclo 05) se quita el modo heredado.
- Sin API para renombrar videos: «Renombrar» queda solo en el ⋮ de las carpetas.
- Defecto visto en la revisión: cada tarjeta muestra dos «Abrir» (el botón y el enlace a la publicación); se corrige en TASK-003.

