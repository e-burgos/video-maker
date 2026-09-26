# spec-e-burgos-018-producer-free-tier cycle-04 — 2026-09-26

## Estado
Versión **0.2.0** publicada en R2 (`/descargas/Video-Maker-0.2.0-arm64.dmg` y el estable), sha256 verificado sobre la
descarga completa.

## Estructura
`CHANGELOG.md` con la sección 0.2.0. Desde el arnés, `open -a` sobre la app sale 0 pero la app muere
(`codesign_util task_name_for_pid`), también con 0.1.0: para pruebas, lanzar el binario directo con un `env` armado a mano.

- `nodeCommandRunner` (`login-shell-path.ts`) corre el comando en su propio grupo de procesos y, al vencer el
  timeout, mata el grupo y resuelve en el acto: antes mataba solo al shell y esperaba el `close` de los pipes, que un
  nieto (un `sleep`, algo del `.zshrc`) podía tener abiertos — en Linux (CI) el test tardaba 5 s y fallaba desde la 017.

## Dependencias
Sin cambios.

## Qué sigue
Probar la instalación en la Mac de un amigo.
