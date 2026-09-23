# Constitución — apps/desktop

> Versión 1.0 | Última actualización: cycle-0 (inicial, abierto por spec-e-burgos-017-desktop-app cycle-03)

## 1. Propósito

- **Tipo:** app Electron (macOS arm64)
- **Rol en el sistema:** empaqueta el estudio como app de escritorio autocontenida para repartir
  entre amigos: arranca `render-api` como proceso hijo, muestra la web en su ventana, prepara el
  primer arranque (modelos, carpeta de proyectos, CLI `claude`) y genera el `.dmg` sin firmar.

## 2. Stack tecnológico

- Electron + electron-builder, TypeScript, Vitest. Binarios de terceros en `vendor/darwin-arm64`
  generados por un script reproducible con sha256 fijados.

## 3. Estructura y patrones

- `src/main/` proceso principal (rutas de la app, proceso de `render-api`, descargas, chequeos).
- `src/setup/` y `src/preload/` pantalla de primer arranque, sin acceso de Node en el renderer.
- `scripts/` vendor y build del instalador.

## 4. Convenciones propias

- `render-api` vive en su propio grupo de procesos y se mata como grupo al cerrar o al caerse.
- Nada de la app lee el `.env` ni depende de Homebrew; el `PATH` del usuario se lee de su login shell
  solo para encontrar `claude`.
- `contextIsolation` activo y `nodeIntegration` apagado en todo renderer.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
