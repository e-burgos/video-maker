# Rebranding Cristal Líquido de Video Maker — plan (para aprobar)

Rama: `feat/rebranding-liquid-glass` (desde `main` al día). Solo commits locales. Nada de código de producción escrito todavía.
Capturas del estado actual: `design/rebranding/antes/` (12 pantallas × 1440×900 y 900×700).
Propuesta visual: `design/rebranding/propuesta.html` (+ PNG light/dark de shell y espacio de trabajo).

## 1. Relevamiento

### Hechos verificados
- `@e-burgos/tucu-ui` **no está instalado** en el repo (ni dependencia en `package.json`). Versión publicada: 3.10.1; MCP 0.16.0 conectado.
- `apps/web` es solo dark (slate-950 + sky). `index.css` define tokens propios (`surface`, `ink`, `accent`…), pero ~80 % de los componentes usan slate/sky/emerald crudos. No hay `backdrop-blur` en ningún lado.
- Shell actual: `StudioLayout` = header superior con 4 botones + estado + idioma, y una sub-barra mono con 5-6 pestañas del video. Dos niveles con tipografías distintas.
- `ThemeProvider` de tucu-ui **es router + layout + tema**; la app ya tiene `BrowserRouter` y su propio shell. Es el principal riesgo de montaje (ver §4).
- Electron: ventana 1280×800 sin `minWidth/minHeight`, barra de título nativa, sin ícono declarado. Ventana de setup 640×760 con HTML propio.
- docs-site: 22 HTML (11 páginas × es/en) generados por `render.mjs`/`components.mjs`; un solo `styles.css` (2184 líneas) con tokens en `:root` y Outfit como fuente; acento `#e11d48`/`#6d4aff`. `tech-inventory.spec.mjs` valida el inventario técnico (subproyectos, licencias, versiones).

### Por pantalla: acción principal y qué confunde
| Pantalla | Acción principal | Problemas |
| --- | --- | --- |
| Mis videos (`/`) | Nuevo video | El formulario de carpeta pesa igual que el CTA; cada tarjeta acumula 4 acciones; sin búsqueda con 87 videos. |
| Productor (`/projects/:slug`) | Enviar mensaje | Panel de material/preview/entregas ajustado a un costado; material como chips poco claros; sin estado de faltantes; publicación repetida. |
| Biblioteca (`/library`) | Subir material / Generar montaje | Mezcla navegación, subida, generación y salida; paneles generados arriba de los uploaders; tres links del mismo peso. |
| Motion (`/motion`) | Hacer video | Tres botones de producir en la misma fila; guardar implícito sin aviso; formulario largo sin jerarquía. |
| Storyboard | Proponer / guardar | Cuatro barras de acción; guardar no es sticky. |
| Voz | Regenerar con la voz elegida | Tres puntos de entrada para lanzar jobs; modo guión vs. clásico sin explicar. |
| Vista previa | Renderizar | Página de ~12 secciones sin jerarquía; formato elegido dos veces; Renderizar y Muestra con igual peso. |
| Marcas / editor | Crear marca / Guardar | Navegación de secciones dentro del contenido; guardado por sección; borrar igual de visible en integradas. |
| Publicación | Reanudar | 4 botones iguales por fila; «Quitar» no parece destructivo. |
| Ajustes | Guardar | Cuatro dominios en una página; clave como tarjeta anidada con su propio guardar. |
| Guía | — | Sin estado de error (queda cargando). |

## 2. Lenguaje visual (Cristal Líquido de Video Maker)

- **Adjetivos de marca**: preciso, cálido, cinematográfico.
- **Acción**: `#0a6cff` (dark `#409cff`), cercano al azul actual de la marca; un solo color de acción.
- **Escena**: aurora estática con dos orbes (light `#c7d4ee → #e2d5ea → #f2ded3`, dark `#101322 → #1d1730 → #231b26`). Sin movimiento.
- **Materiales** (del contrato): `thin` chips/segmented · `regular` paneles · `thick` barras y modales · `sub` inputs y celdas dentro de vidrio.
- **Regla propia**: video e imágenes nunca debajo de vidrio ni de blur. Los medios van en superficies opacas (`#0b0d14` para el escenario del video, `--tile` para imágenes) y el vidrio los enmarca. Los rótulos sobre un medio usan un chip sólido, no un panel translúcido. Los modales y el visor ampliado usan fondo opaco oscuro, no blur, cuando hay medios.
- **Reglas del contrato que se respetan**: máximo dos capas de blur apiladas (escena + panel; la sidebar y el panel central no se superponen); sin vidrio en filas ni listas que scrollean (las tarjetas de video son `sub` sin blur sobre un panel con blur); sin sombras negras en light; borde de luz 0,5 px.
- **Tipografía**: Inter (UI) y JetBrains Mono para números, slugs, tiempos y rótulos de sección. Hoy el studio usa la tipografía del sistema, así que se agregan las dos fuentes (empaquetadas con la app, sin Google Fonts en Electron).
- **Radios** 10/16/20; **motion** `condense` 320 ms, hover `scale-[1.02]`, skeleton con pulso; todo apagado con `prefers-reduced-motion`.
- **Light por defecto + dark completo**: hoy solo existe dark, así que light es trabajo nuevo en todas las pantallas. Selector en la sidebar (sistema/claro/oscuro).
- **Estados**: `StateBadge` con tonos fijos para todo el producto: verde = publicado/completo, teal = listo para publicar, naranja = falta material/revisar/pausada, rojo = error, neutral = archivado.

## 3. Arquitectura de información

**Menú lateral (reemplaza el header + sub-barra)**: sidebar de vidrio `regular`, 236 px, colapsable a 72 px bajo 1100 px.
- Producir: **Mis videos**, **Marcas**.
- Salida: **Publicación** (con contador de cola).
- Sistema: **Ajustes**, **Guía**. Pie: estado del servicio (Listo / detalles) e idioma.

**Header = el toolbar del layout (v2, sin cabecera propia)**: se usa el toolbar que ya trae el layout `macos-tahoe` (título + slot `rightButton`) y no se agrega ninguna segunda barra.
- Toolbar: título del paso (`pageTitle`) + nombre del video en chico, estado del video y **una sola acción principal** a la derecha (Nuevo video / Renderizar / Proponer storyboard / Regenerar voz según el paso).
- Los **pasos** pasan a la sidebar: al abrir un video aparece, bajo «Mis videos», un bloque «este video» con Productor · Material · Storyboard · Voz · Vista previa y un punto de estado por paso. Es navegación, no cabecera.
- **Marca** pasa a un chip en el panel de Vista previa (es lo que se aplica al render); **formato** 16:9/9:16 queda en ese mismo panel; búsqueda y «Nueva carpeta» de Mis videos bajan al contenido.
- **Por verificar en el spike (FIX-086)**: el MCP no documenta `MacOSToolbar`/`MacOSSidebar` ni cómo cambiar el `rightButton` por ruta (en el layout es una prop global). Si no hay un slot por ruta, se resuelve con un portal que la página monta en el toolbar, o con la acción como botón fijo al pie del panel principal. Tampoco confirmé que la sidebar admita un bloque anidado por video; si no, el bloque es un componente propio dentro de ella.

**Espacio de trabajo del video** (dos zonas fijas, sin saltos de página):
- Izquierda: **Productor** (chat, pasos de actividad, sugerencias como chips; compositor anclado abajo con adjuntar y modelo).
- Derecha arriba: **Vista previa** sobre escenario opaco con selector de formato; metadatos en mono.
- Derecha abajo: **Material | Entregas**. Material = checklist por rol (A-roll, música, logo, voz) con estado completo/falta/revisar y una acción por rol, más grilla de imágenes. Entregas = renders y publicación (un solo lugar; se quitan las dos copias restantes).
- Storyboard, Voz y Vista previa completa siguen siendo pasos propios (rutas actuales), pero comparten la cabecera y la regla «una acción principal». Guardar pasa a barra pegajosa inferior.

**Imágenes**: grilla uniforme con rol en chip sólido; **visor ampliado** (overlay opaco, flechas, zoom, tecla `C` para comparar dos lado a lado); selección múltiple para asignar rol o borrar. No hay visor hoy: es un componente nuevo propio (tucu-ui no trae galería ni lightbox según el MCP; sí `Image`/`SafeImage`).

**Otras pantallas**:
- Mis videos: búsqueda, chips de carpeta, tarjetas con una acción (Abrir) y menú ⋮; «Nueva carpeta» pasa a secundaria.
- Marcas: tarjetas; editor con navegación de secciones como columna del panel y una barra de guardado única; integradas en solo lectura sin «Borrar».
- Publicación: tabla/lista con reordenar por arrastre (↑↓ quedan como alternativa de teclado), «Quitar» como acción destructiva en el menú; estado de pausa en el encabezado.
- Ajustes: pestañas Productor · Voz · YouTube (una por dominio).

### Vistas diseñadas (light y dark) — `design/rebranding/vistas/` y `vistas.html`
Mis videos y espacio de trabajo (`propuesta-*.png`), más: marcas (listado y editor), ajustes (con pestaña **Apariencia**: tema sistema/claro/oscuro, materiales vidrio/sólidos, idioma), biblioteca de imágenes con selección múltiple, visor ampliado con comparación, storyboard, voz, vista previa y render, motion (brief), cola de publicación, **guía** (índice + artículo con pasos, tips y navegación anterior/siguiente) y el **chat del productor** en dos estados: conversación (mensajes, pasos de actividad del turno, propuesta de guion con aprobar/pedir cambios, material sugerido, sugerencias rápidas y compositor) y primer uso (material del video, recetas, arranques sugeridos y zona de arrastre). Los dos chats se muestran dentro de la ventana de Electron, con los botones de ventana sobre la sidebar.
Reglas que se repiten en todas: un toolbar con una sola acción principal; las acciones secundarias van a un botón gris o al menú ⋮; guardar es una barra pegajosa inferior; los medios van sobre superficie opaca (incluido el visor, que es opaco y sin blur); las secciones largas se pliegan y se abre una a la vez.
Vistas que quedan sin diseño propio porque derivan de estas: modales (confirmar borrado, nombrar marca, publicar en YouTube: `thick` sobre fondo oscuro opaco), estados vacíos, de carga (skeleton) y de error (aviso `StateBadge` rojo con «Reintentar»), y la ventana de configuración inicial de Electron (usa el mismo fondo y botón de acción).

## 4. Montaje de tucu-ui en `apps/web` (incremental)

1. Agregar `@e-burgos/tucu-ui@3.10.1` (pnpm) y, en `index.css`: `@import '@e-burgos/tucu-ui/theme'` + `@source` a los `.mjs` del paquete, con los tokens `--tucu-*` del contrato bajo `:root` y `.dark`. Sin `styles` (evita doble Tailwind).
2. **Spike de la fase 0**: confirmar que `GlassPanel`, `SegmentedControl`, `StateBadge`, `Button`, `Modal` y `Collapse` funcionan **sin** `ThemeProvider` como shell, o envueltos solo en `ThemeScope`. Si alguno exige el provider, se monta `ThemeProvider` en modo mínimo (sin layout propio) manteniendo `BrowserRouter`; si tampoco alcanza, se usa su router con `customRoutes` y se migra el shell en la fase 1. La decisión queda registrada en el FIX.
3. Convivencia: los tokens nuevos (`--cl-*`, `--tucu-*`) se agregan al lado de los actuales (`surface`, `ink`…); las pantallas no migradas siguen con su estilo hasta su fase. El modo claro se habilita por pantalla migrada (clase `dark` en `html`), así que las pantallas viejas se ven solo en dark hasta pasar por su fase.
4. Utilidades `glass*`, `focus-cl` y las reglas de `prefers-reduced-transparency`, `prefers-contrast` y `@supports` del contrato, después del `@import` del tema.

## 5. Fases (un FIX por fase, desde FIX-e-burgos-086)

| FIX | Fase | Entrega | Cierre |
| --- | --- | --- | --- |
| 086 | Base: dependencia, tokens, escena, fuentes, light/dark, spike | `index.css`, `ThemeScope`, utilidades | lint/test/build web |
| 087 | Shell y menú lateral + Electron (`minWidth`, barra de título, ícono) | `StudioLayout` nuevo, selector de tema | capturas antes/después + specs de layout |
| 088 | Mis videos | `projects-page`, `video-card` | spec de la página |
| 089 | Espacio de trabajo: productor + material + vista previa | `project-workspace-page`, `workspace-side-panel`, productor | spec + smoke del workspace |
| 090 | Biblioteca de imágenes y visor | `asset-library-page`, visor nuevo | spec + test del visor (teclado) |
| 091 | Storyboard y voz | páginas y barras de guardado | specs |
| 092 | Vista previa final y motion | `project-preview-page`, `motion-page` | specs |
| 093 | Marcas | `brands-page`, `brand-editor-page` | specs |
| 094 | Cola de publicación y ajustes | páginas | specs |
| 095 | docs-site: solo imágenes nuevas del productor (el diseño del sitio no se toca) | capturas en `public/screenshots/` y su referencia en las páginas que ya muestran el estudio | test del sitio + `check-links` |

Cada fase corre `pnpm nx run-many -t lint test build -p web` (y docs-site cuando toca) y `pnpm sdd:validate`, y guarda capturas «después» en `design/rebranding/despues/<fase>/`. Un FIX por fase, registro mínimo en `sdd/fixes.json` (modo fix rápido).

**Docs-site (decisión tuya)**: la web pública no se rediseña: ni `styles.css`, ni tokens, ni logo, ni fuentes. Al terminar el productor, se reemplazan o suman capturas del estudio nuevo en `public/screenshots/` (y en `capture-screenshots.mjs` si las genera) y se referencian en las páginas que ya muestran el estudio. No cambian subproyectos ni textos del inventario, así que `tech-inventory.spec.mjs` no debería romperse; se corre igual.

**Electron**: `apps/desktop` carga la UI de `apps/web` servida por el render-api, así que el rediseño llega a la app de escritorio sin trabajo extra de componentes. Lo propio de Electron va en el FIX-087: `minWidth`/`minHeight`, `titleBarStyle: 'hiddenInset'` con los botones de ventana sobre la sidebar (como en las maquetas del chat), zona de arrastre en el toolbar (`-webkit-app-region: drag`, con los botones y campos excluidos), `backgroundColor` según tema para evitar el destello al abrir, ícono de la app y la ventana de configuración inicial con el mismo fondo y botón de acción. Hay que probar el vidrio en Electron (el `backdrop-filter` anda en Chromium, pero la ventana debe ser opaca por debajo, sin `transparent: true`).

## 6. Calidad
- Contraste AA medido (script con Playwright sobre pares texto/fondo reales, light y dark, en la superficie más translúcida) por fase.
- `prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast` probados emulando cada uno.
- Costo de blur: medir con el Performance panel en Mis videos con 87 tarjetas y en la vista previa mientras reproduce; si cae de 55 fps se pasa a `data-material="solid"`. Interruptor «Materiales sólidos» en Ajustes para equipos lentos.
- Foco visible, orden de tabulación, atajos del visor y mínimo táctil 44 px; textos en español con tildes (se revisa con grep sobre los mensajes i18n).
- Ventana de Electron: mínimo propuesto 960×640; probado a 900×700 y 1280×800.

## Decisiones que necesito de vos
1. **Light por defecto o dark por defecto.** Hoy el studio es solo dark; el contrato Cristal Líquido es light por defecto. Propongo «seguir al sistema» con light como respaldo.
2. **Acento**: `#0a6cff` (azul de la guía) o mantener el sky actual. Propongo `#0a6cff`.
3. **Visor de imágenes propio** (tucu-ui no trae uno). Propongo hacerlo chico y con la regla de medios opacos.
4. **Fuentes Inter y JetBrains Mono empaquetadas** en `apps/web` (sin CDN).
5. Fuera de alcance: `apps/motion-editor`.
