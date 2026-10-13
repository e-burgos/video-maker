# Constitución — apps/desktop

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** app Electron (macOS arm64)
- **Rol en el sistema:** empaqueta el estudio como app de escritorio autocontenida para repartir
  entre amigos: arranca `render-api` como proceso hijo, muestra la web en su ventana, prepara el
  primer arranque (modelos, carpeta de proyectos, CLI `claude`) y genera el `.dmg` sin firmar.

## 2. Stack tecnológico

- Electron 44.4.5 (Node 24) + electron-builder 26.15.3 + @electron/rebuild 4.2.0, TypeScript, Vitest.
  `electronDist` apunta al Electron de `node_modules` (`~/Library/Caches/electron` del dev es de `root`). Binarios de terceros en `vendor/darwin-arm64`
  generados por un script reproducible con sha256 fijados.

## 3. Estructura y patrones

- `src/main/` proceso principal: `main.ts` (bootstrap, ventanas, menú en español), `app-paths.ts`,
  `preferred-port.ts` + `setup-state.ts` (`setup.json`: modelos, carpeta de proyectos, puerto),
  `render-api-process.ts` (grupo de procesos, logs rotados, health con `x-studio-token`), `render-api-env.ts`
  (allowlist; fija `BRANDS_ROOT = dirname(projectsFolder)/brands`, `MOTION_GRAPHICS_ASSETS`,
  `HYPERFRAMES_RESOLVE_FROM` y el ffmpeg propio primero en `PATH`), `render-api-pid-guard.ts`,
  `kill-orphan-chrome.ts` (por comando: launchd ya reparentó a Chrome cuando la app se entera),
  `login-shell-path.ts` (`nodeCommandRunner` corre en su propio grupo y al vencer el timeout mata el grupo),
  `claude-cli-check.ts` (`claude auth status`), `model-downloads.ts`, `menu-strings.ts`,
  `external-navigation.ts` (`externalUrlToOpen`).
- `src/setup/` y `src/preload/` pantalla de primer arranque sandboxeada, sin acceso de Node en el renderer;
  el preload no puede importar archivos del proyecto (solo `electron` y builtins).
- `scripts/`: `vendor-binaries.mjs`, `build-desktop.mjs`, `after-pack.cjs` (copia los `node_modules` que
  electron-builder descarta a `extraResources` y firma ad hoc: con `identity: null` no firma nada),
  `release-desktop.mjs`.
- `e2e/packaged-app-smoke.mjs` (`--engine=openrouter`; espera `waitForTurnRunning` antes de esperar el fin del turno).
- `render-api` empaquetado lleva `hyperframes@0.8.139` (y sus nativos `sharp`, `onnxruntime-node`) en
  `resources/render-api/node_modules` y `libs/motion-graphics/assets` como `motion-assets`.

## 4. Convenciones propias

- `render-api` vive en su propio grupo de procesos y se mata como grupo al cerrar o al caerse.
- Nada de la app lee el `.env` ni depende de Homebrew; el `PATH` del usuario se lee de su login shell
  solo para encontrar `claude`.
- `contextIsolation` activo y `nodeIntegration` apagado en todo renderer.
- Registrar siempre un `window-all-closed` que no haga nada: sin listener, macOS cierra la app al cerrarse la
  ventana de primera apertura.
- La ventana principal niega ventanas hijas y manda a `shell.openExternal` toda URL http/https de otro origen
  (incluido el consentimiento de Google); `will-navigate` externo se cancela.
- Distribución: `pnpm desktop:release` (build, copia estable, sha256, notas desde `CHANGELOG.md`; con `--publish`
  sube a R2 con `wrangler` y verifica por HEAD) hacia https://video.estebanburgos.com.ar/descargas/. Sin firma
  (ad hoc) Gatekeeper bloquea: se habilita con "Abrir igual"; sin firma no hay auto-actualización, cada versión se
  reinstala a mano. Incluye `Resources/licenses/` y `THIRD_PARTY_NOTICES.md`.
- Pruebas: `open -a` desde el arnés mata la app (`codesign_util task_name_for_pid`); lanzar el binario directo con
  un `env` armado a mano.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).

## Lecciones específicas

- Los flags del CLI de voz van como `--flag=valor`: con espacio se rompía la voz.
