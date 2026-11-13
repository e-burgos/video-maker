# SPEC-e-burgos-025: Rediseño Cristal Líquido del estudio y paridad de funciones con la web

> Estado: **in-progress** — registrada el 2026-11-13, flow **lite** (perfil `solo`, confirmado por el dev).
> Pedido del dev: rebranding visual completo del estudio (`apps/web`, que también es la UI de la app de escritorio) con
> Liquid Glass sobre tucu-ui, y traer a la app las funciones que hoy solo maneja la web pública. La web pública no se
> rediseña: solo suma capturas del productor nuevo al final.
> Material de diseño aprobado: `design/rebranding/` (`plan.md`, `vistas.html`, `vistas/*.png`, `antes/*.png`).

## Situación actual

- `apps/web` es solo dark (slate/sky); ~80 % de los componentes usan colores crudos y no hay ningún `backdrop-filter`.
  El shell son dos barras de navegación con tipografías distintas, y varias pantallas tienen 3 o 4 acciones con el mismo peso.
- `@e-burgos/tucu-ui` no está instalado. Su `ThemeProvider` es router + layout + tema y la app ya tiene su propio
  `BrowserRouter` y shell: el montaje se decide en un spike.
- La ventana de Electron no tiene tamaño mínimo ni barra de título propia; carga la UI de `apps/web` servida por el render-api.
- La web maneja contenido que la app no tiene: guía interactiva por caminos con pasos, pipeline, tutorial en video,
  galería, preguntas frecuentes, inventario de tecnología y licencias dentro de la app, versión y actualizaciones,
  instrucciones para conectar agentes de IA (plugin/MCP), búsqueda de material libre y chequeo de requisitos.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Base visual: tucu-ui montado, tokens `--tucu-*`, escena aurora, Inter y JetBrains Mono empaquetadas, tema sistema/claro/oscuro, materiales vidrio/sólidos, `prefers-reduced-transparency` | cycle-01 |
| O-2 | Shell nuevo: sidebar de vidrio con bloque «este video» y pasos con estado, toolbar del layout con una sola acción principal por ruta, y ventana de Electron con tamaño mínimo, barra de título propia y fondo por tema | cycle-01 |
| O-3 | Espacio de trabajo del video: chat del productor (conversación y primer uso), vista previa sobre escenario opaco y material por rol con faltantes; Mis videos con búsqueda y una acción por tarjeta | cycle-02 |
| O-4 | Biblioteca de imágenes con selección múltiple, visor ampliado con comparación (teclado), storyboard y voz con barra de guardado pegajosa | cycle-03 |
| O-5 | Vista previa y render con ajustes plegables, motion (brief) y marcas (listado y editor con guardado único) | cycle-04 |
| O-6 | Publicación, ajustes (pestañas Productor, Voz, YouTube, Apariencia), guía, modales y estados vacío/carga/error; capturas del productor nuevo para la web | cycle-05 |
| O-7 | Paridad con la web: Aprender (guía interactiva con pasos, pipeline, tutorial desde R2, galería, FAQ), Acerca de (versión, buscar actualizaciones manual, licencias e inventario, código abierto, privacidad), Conectar agentes, búsqueda de material libre y chequeo de requisitos | cycle-06 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | Spec en flow `lite`, 6 ciclos agrupados en lugar de un fix por fase | Decisión del dev (2026-11-13): trazabilidad y contrato visual documentado |
| D-02 | tucu-ui 3.10.1 con Tailwind propio (`@import '@e-burgos/tucu-ui/theme'` + `@source`), nunca `styles` | Evita doble Tailwind (skill tucu-ui-pro) |
| D-03 | Se conserva `BrowserRouter` y el shell propio; el spike del cycle-01 decide si alcanza `ThemeScope` o hace falta `ThemeProvider` mínimo | `ThemeProvider` es router + layout; el MCP no documenta `MacOSToolbar`/`MacOSSidebar` |
| D-04 | Los medios (video e imágenes) nunca van bajo vidrio ni blur; el visor y los modales con medios son opacos | Regla propia del producto; contenido legible y sin costo de blur |
| D-05 | Máximo dos capas de blur apiladas y nada de vidrio en filas o listas que scrollean | Contrato Cristal Líquido y costo de render |
| D-06 | Light/dark/sistema con materiales `sólidos` como válvula de escape; se activa solo con `prefers-reduced-transparency` | Equipos lentos y accesibilidad |
| D-07 | Una sola acción principal por toolbar; el resto en botón secundario o menú ⋮; guardar como barra pegajosa inferior | Jerarquía de acciones pedida por el dev |
| D-08 | Actualizaciones: «Buscar actualizaciones» manual (compara versión instalada con la publicada y lleva a la descarga); sin `autoUpdater` | La app no está firmada (`identity: null`) y macOS lo exige |
| D-09 | La app mantiene su propia copia del contenido (guía, FAQ, privacidad, inventario) alineada con la web, sin tocar el generador de `apps/docs-site` | La web no se modifica; evita acoplar los builds |
| D-10 | Tutorial en video: se reproduce desde R2 (necesita internet) | Decisión del dev (2026-11-13) |
| D-11 | `apps/docs-site` solo suma capturas nuevas en `public/screenshots/`; sin cambios de diseño, tokens ni textos | Decisión del dev (2026-11-13) |
| D-12 | `apps/motion-editor` queda fuera | Alcance acordado |
| D-13 | Sin comentarios en el código; nombres declarativos y componentes chicos | Regla del repo |
| D-14 | Solo commits locales en `feat/rebranding-liquid-glass`; sin push ni PR hasta que el dev lo pida | Directiva del dev |

## Dependencias

- `spec-e-burgos-017-desktop-app` (Electron y `apps/docs-site`).
- `spec-e-burgos-024-docs-site-redesign` (inventario de tecnología y guía de la web que el cycle-06 replica en la app).

## Ciclos

| Ciclo | Contenido | Subproyectos |
| --- | --- | --- |
| cycle-01 | Base visual, spike de tucu-ui, tema, shell y Electron | `apps/web`, `apps/desktop` |
| cycle-02 | Mis videos y espacio de trabajo con chat del productor | `apps/web` |
| cycle-03 | Biblioteca de imágenes, visor, storyboard y voz | `apps/web` |
| cycle-04 | Vista previa y render, motion y marcas | `apps/web` |
| cycle-05 | Publicación, ajustes, guía, modales, estados y capturas para la web | `apps/web`, `apps/docs-site` |
| cycle-06 | Paridad con la web (Aprender, Acerca de, Conectar agentes, material libre, requisitos) | `apps/web`, `apps/render-api`, `apps/desktop` |

## Verificación por ciclo

`pnpm nx run-many -t lint test build -p web` (más los subproyectos tocados), `pnpm sdd:validate`, capturas antes y
después en el ciclo, contraste AA medido en light y dark, `prefers-reduced-motion`, `prefers-reduced-transparency` y
foco visible. Los pendientes de cada ciclo se anotan en el `plan.md` del ciclo siguiente.
