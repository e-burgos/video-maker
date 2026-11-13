# spec-e-burgos-025-liquid-glass-rebrand cycle-01 — 2026-11-13

## Estado
- Ventana principal 1280×800 con mínimo 960×640 (verificado en la ventana real: achicar a 700×500 queda en 960×640), `titleBarStyle: 'hiddenInset'` con los botones en (26, 28) sobre la sidebar, `backgroundColor` `#101322`/`#e8eaf0` según `nativeTheme`, `show()` en `ready-to-show`, sin `transparent` ni `vibrancy`.
- Ventana de configuración inicial con el mismo lenguaje (aurora, tarjeta de vidrio, acción azul, marca y firma) y zona de arrastre; comportamiento y textos sin cambios.
- Ícono nuevo de la app (`build/icon.icns`, `build/icon.png`) declarado en `mac.icon`.

## Estructura
- `src/main/window-options.ts`: funciones puras `mainWindowOptions(theme)` y `setupWindowOptions(theme, preload)`, testeadas.
- La UI web detecta Electron por user agent (`data-shell="electron"`) para reservar el espacio de los botones de ventana y marcar el toolbar como zona de arrastre.

## Dependencias
- `THIRD_PARTY_NOTICES.md` (generado por `scripts/vendor-binaries.mjs`) suma la sección «Fonts (app interface)» con Inter y JetBrains Mono (SIL OFL 1.1).

## Qué sigue
- Sin probar en la app real: la ventana de configuración inicial (dispararía descargas de modelos) y el costo del `backdrop-filter` con GPU real; revisarlos con el próximo `.dmg`.
- `mac.icon` usa ruta desde la raíz del repo porque electron-builder se invoca desde ahí.
- Para probar la app de desarrollo sin tocar la instalada: `VIDEO_MAKER_USER_DATA` a una carpeta temporal con una copia de `setup.json` (proyectos en carpeta temporal y `preferredPort` nulo) y `WEB_DEV_URL` al studio; el inspector del main se abre con `SIGUSR1` al PID real de Electron.
