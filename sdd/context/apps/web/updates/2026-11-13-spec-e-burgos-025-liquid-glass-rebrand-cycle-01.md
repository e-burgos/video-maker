# spec-e-burgos-025-liquid-glass-rebrand cycle-01 — 2026-11-13

## Estado
- Rediseño Cristal Líquido en marcha: tucu-ui 3.10.1 montado con Tailwind propio, tokens `--tucu-*` y `--cl-*` (claro y oscuro), escena aurora estática, Inter y JetBrains Mono empaquetadas, tema sistema/claro/oscuro y materiales vidrio/sólidos sin destello inicial.
- Shell nuevo en todas las rutas: sidebar de vidrio con logo y firma, bloque «este video» con pasos, toolbar con una sola acción por página, pie con estado (modal de tucu-ui), idioma (switch) y apariencia. Las pantallas viejas siguen dentro de una superficie heredada oscura y opaca hasta su ciclo (`isMigratedRoute`, hoy `false` para todas).
- Logo nuevo (V dentro de la lente, coral a violeta, firma «by Esteban Burgos» solo en lockups), favicon y `BrandMark`/`BrandWordmark`.

## Estructura
- `src/theme/`: `scene.tsx`, `theme-preferences.ts`, `theme-context.tsx` (`ThemeProvider`, `useThemePreferences`), `theme-switch.tsx`. Script inline en `index.html` aplica tema, material y `data-shell="electron"` antes del primer render.
- `src/components/shell/`: sidebar, navegación, pasos del video, toolbar, contexto y hook `useToolbarAction({ label, onClick, disabled, loading })`, contenido con superficie heredada, pie (`footer-control-style.ts` con `FOOTER_CONTROL_CLASS`: todos los controles del pie miden 40 × 192 px) y modal de estado del servicio.
- `src/components/ui/brand-mark.tsx` (generado por `design/rebranding/logo/build-logo.mjs`; etiquetas por prop desde el catálogo).
- Reglas nuevas del subproyecto: (1) el escáner `no-literal-copy.spec.ts` recorre `{app,components,pages}/*.tsx` sin recursión y confunde genéricos de TypeScript seguidos de texto con JSX: los componentes nuevos van en subcarpetas (`components/shell/`, `components/ui/`) o con la lógica en `.ts`; (2) la información de apoyo se muestra en modales de tucu-ui, no en paneles flotantes absolutos; (3) medios (video e imágenes) nunca bajo vidrio ni blur; (4) texto activo con `--cl-action-text` y rótulos con `--cl-ink-3` para cumplir AA (medido); (5) `SegmentedControl` dentro de paneles angostos con `size="xs"` y `fullWidth`.

## Dependencias
- `@e-burgos/tucu-ui` 3.10.1, `@fontsource-variable/inter` 5.3.0 y `@fontsource-variable/jetbrains-mono` 5.3.0, exactas en el `package.json` raíz. Nunca `@e-burgos/tucu-ui/styles` (doble Tailwind).

## Qué sigue
- Ciclos 02 a 05 migran pantalla por pantalla (ampliando `isMigratedRoute`, declarando la acción del toolbar y alimentando el estado de los pasos); el selector de apariencia pasa a Ajustes en el ciclo 05; ciclo 06 trae la paridad con la web.
- Una ventana de Electron abierta durante muchas recargas en caliente de los catálogos i18n puede mostrar claves sin traducir: recargar la ventana; no es un defecto.
