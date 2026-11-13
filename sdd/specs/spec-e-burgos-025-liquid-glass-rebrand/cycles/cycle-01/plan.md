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

## Tokens, escena y fuentes (TASK-002, commit 6cfe3a9)
- Fuentes: `@fontsource-variable/inter` y `@fontsource-variable/jetbrains-mono` 5.3.0 exactas, importadas en `index.css` y empaquetadas (la app corre offline). Familias `'Inter Variable'` y `'JetBrains Mono Variable'`, expuestas como `--font-ui` / `--font-data` y las utilidades `font-ui` / `font-data` (tabular-nums). No reemplazan `--font-sans` / `--font-mono`: las pantallas nuevas las usan explícitamente y se pasa a reemplazar los `--font-*` cuando migren las viejas.
- Tintas de estado: light del contrato y dark de las maquetas; purple (`#d8a8ff`) y neutral en dark los definió la implementación porque las maquetas no los traían. Variables agregadas fuera del contrato original: `--cl-action-hover` y `--tucu-glass-sub-line`.
- Licencias: sección «Fonts (app interface)» (SIL OFL 1.1) en `THIRD_PARTY_NOTICES.md`, que se genera desde `apps/desktop/scripts/vendor-binaries.mjs`; la plantilla del script se actualizó igual. El test de `docs-site` no exigió tocar su inventario.
- `Scene` (`apps/web/src/theme/scene.tsx`): aurora estática con dos orbes, `aria-hidden`, sin textos.

## Tema y materiales (TASK-003, commit 921d9d9)
- Lógica en `apps/web/src/theme/` (fuera del escáner de textos literales): `theme-preferences.ts` (claves `vm-theme` y `vm-material`, resolución, localStorage con try/catch, `applyThemeToDocument`), `theme-context.tsx` (`ThemeProvider` y `useThemePreferences`, sigue `prefers-color-scheme`) y `theme-switch.tsx` (dos `SegmentedControl`: Sistema/Claro/Oscuro y Vidrio/Sólidos). El selector todavía no está montado en ninguna pantalla.
- Sin destello: script inline en `index.html` con la misma lógica de resolución; un spec lo ejecuta y lo compara contra `applyThemeToDocument`.
- Verificado en el studio real: en oscuro y en claro el `<html>` recibe `dark`/`data-theme`, sin errores de consola, y las pantallas actuales conservan fondo y fuente.
- El contexto no sabe de `prefers-reduced-transparency` ni de contraste: viven solo en el CSS de TASK-002.
- Consecuencia para TASK-004: en modo claro las pantallas viejas (texto claro sobre fondo oscuro fijo) quedarían ilegibles sobre la escena clara, así que el shell las envuelve en una superficie oscura opaca hasta que migren.

## Shell (TASK-004, commit d3409ca)
- `StudioLayout` nuevo sobre la `Scene`: sidebar `glass` de 236 px (riel de 72 px bajo 1100 px), toolbar `glass-thick` con título por ruta y una acción declarada por cada página con `useToolbarAction({ label, onClick, disabled, loading })`, y bloque «este video» con pasos y `ProjectBrandControl` en su pie. Componentes nuevos en `apps/web/src/components/shell/` (fuera del escáner de textos literales); `studio-layout.tsx` se queda en `components/` porque el test lo exige.
- `isMigratedRoute(pathname)` devuelve `false` para todo: las pantallas actuales van dentro de una superficie heredada oscura y opaca (`data-surface="legacy"`, sin blur). Los ciclos 02 a 05 la van ampliando pantalla por pantalla.
- Los pasos usan las claves `nav.*`; la mayúscula inicial se aplica con un `span` (`first-letter:uppercase` no funciona sobre texto suelto dentro de un contenedor flex). El título del toolbar para library es «Biblioteca». Las claves `layout.title` y `layout.subtitle` quedaron sin uso.
- Sin estado real en los pasos todavía: el prop `status` existe (default `pending`) y el layout no tiene datos; el ciclo 02 lo alimenta. El slot `status` del toolbar existe y está sin usar.
- Provisorio: el `ThemeSwitch` vive en un `Collapse` «Apariencia» del pie de la sidebar hasta que el ciclo 05 lo pase a Ajustes; en el riel (< 1100 px) ese pie solo muestra el idioma.
- Los testids de los e2e (`project-nav`, `brands-nav`, `publish-queue-nav`, `settings-nav`, `guide-nav`, `language-switch`) se mantuvieron.

## Electron (TASK-005, commit c8b1fab)
- `apps/desktop/src/main/window-options.ts`: funciones puras `mainWindowOptions(theme)` y `setupWindowOptions(theme, preload)`; ventana principal 1280×800 con mínimo 960×640, `titleBarStyle: 'hiddenInset'`, botones en (16, 16), `backgroundColor` `#101322`/`#e8eaf0` según `nativeTheme`, `show: false` y `show()` en `ready-to-show`, sin `transparent` ni `vibrancy`. La ventana de configuración inicial (640×760 fija) usa el mismo lenguaje: aurora, tarjeta de vidrio, acción azul y marca con la firma.
- Ícono: `mac.icon: apps/desktop/build/icon.icns` explícito, porque electron-builder se invoca desde la raíz del repo y el `build/` por defecto no se resolvía.
- Web: `html[data-shell='electron']` (por el user agent `Electron/`) reserva 36 px arriba del logo para los botones de ventana y vuelve zona de arrastre al toolbar, con botones, links e inputs en `no-drag`.
- Corrección de paso: `desktop:lint` estaba roto desde TASK-002 (backticks sin escapar en la plantilla de `THIRD_PARTY_NOTICES.md`, `vendor-binaries.mjs`).
- **Sin verificar en la app real**: no se lanzó Electron. Queda por probar a mano la altura de los botones de ventana contra la sidebar, que los botones del toolbar sigan clicables con la zona de arrastre, el destello de apertura, el ícono empaquetado y el `backdrop-filter` de la ventana de configuración. Si el usuario eligió un tema distinto al del sistema, el fondo inicial puede diferir un instante (el main no lee el `localStorage`).

## Verificación del ciclo (TASK-006)
- Script reproducible `design/rebranding/verify-cycle.mjs`; resultados en `artifacts/task006-verificacion.json` y 48 capturas (12 pantallas × claro/oscuro × 1440/900 px).
- Contraste AA medido sobre el fondo real renderizado (texto transparente + muestreo de píxeles): salieron cinco por debajo de 4,5:1 (rótulo de sección en claro 4,34 e ítem/paso activo 3,76 en claro y 3,8 en oscuro). Corregido con `--cl-ink-3` (`#5c5c61`) y el token nuevo `--cl-action-text` (`#0353c9` claro, `#8cc2ff` oscuro) para el texto activo; ahora todo ≥ 4,5:1.
- `prefers-reduced-transparency` apaga el blur (`backdrop-filter: none`), `prefers-contrast: more` pasa el borde a 1 px y `data-material="solid"` también apaga el blur; `prefers-reduced-motion` se respeta (el contexto y las pantallas no animan nada en loop).
- Costo del blur, orientativo (Chromium headless con render por software, scroll de 3 s en Mis videos con 87 videos): 52 cuadros por segundo con vidrio contra 116 con materiales sólidos. En GPU real debería ser menor la diferencia, pero no se pudo medir; por eso el interruptor «Materiales sólidos» queda como válvula de escape y hay que medir en la app real.
- Los 56 errores de consola de la corrida son 404 de la API por datos que ese video no tiene (voz, storyboard, revisiones, vista previa de marca sin generar); ya existían y no vienen del shell.

## Revisión en la app real (Electron de desarrollo, con el dev)
- Botones de ventana: en (16, 16) quedaban pegados a la esquina redondeada de la sidebar; pasaron a (26, 28) y el espacio reservado arriba del logo bajó de 36 a 32 px. Confirmado por el dev en la ventana real.
- Controles de apariencia: el SegmentedControl con tamaño por defecto se salía del pie de 192 px (el «Dark» quedaba cortado). Ahora van con size xs y fullWidth; medido en es/en y claro/oscuro: 192 px de ancho, sin scroll horizontal, terminan dentro del pie. Es el mismo componente en la web y en Electron.
- Pendiente de esta revisión: el panel flotante de «detalles» del estado del servicio pisa la sidebar y el contenido; pasa a un modal de tucu-ui y el pie se reorganiza (estado, detalles e idioma).

