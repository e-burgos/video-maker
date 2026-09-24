# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
App creada y verificada sobre el `.dmg` real: primera apertura, importación, Receta Tutorial desde la
ventana, API local cerrada, cierre y crash sin procesos huérfanos, reapertura con los datos intactos.
Sin firma (ad hoc): Gatekeeper la bloquea y se habilita con "Abrir igual".

## Estructura
- `src/main/`: `main.ts` (bootstrap, ventanas, menú en español), `app-paths.ts`, `preferred-port.ts` +
  `setup-state.ts` (`setup.json`: modelos, carpeta de proyectos, puerto), `render-api-process.ts` (grupo de
  procesos, logs rotados, health con `x-studio-token`), `render-api-env.ts` (allowlist), `render-api-pid-guard.ts`,
  `kill-orphan-chrome.ts` (por comando, porque launchd ya reparentó a Chrome cuando la app se entera),
  `login-shell-path.ts`, `claude-cli-check.ts` (`claude auth status`), `model-downloads.ts`, `menu-strings.ts`.
- `src/setup/` + `src/preload/`: ventana de primera apertura sandboxeada; el preload no puede importar archivos
  del proyecto (solo `electron` y builtins).
- `scripts/`: `vendor-binaries.mjs`, `build-desktop.mjs`, `after-pack.cjs` (copia los `node_modules` que
  electron-builder descarta en `extraResources` y firma ad hoc: con `identity: null` no firma nada).
- Siempre registrar un `window-all-closed` que no haga nada: sin ningún listener, macOS cierra la app al
  cerrarse la ventana de primera apertura.

## Dependencias
electron 44.4.5 (Node 24), electron-builder 26.15.3, @electron/rebuild 4.2.0. `electronDist` apunta al
Electron de `node_modules` porque `~/Library/Caches/electron` del dev es de `root`.

## Qué sigue
`cycle-04` suma OpenRouter como motor (la ventana de primera apertura ya permite seguir sin Claude).
`cycle-06` publica el `.dmg` y documenta "Abrir igual" y la App Translocation.
