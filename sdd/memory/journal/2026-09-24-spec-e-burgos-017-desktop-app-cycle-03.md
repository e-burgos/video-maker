# spec-e-burgos-017-desktop-app cycle-03 (TASK-010) — 2026-09-24

## Qué pasó

Al verificar el `.dmg` recién empaquetado, lanzar `Video Maker.app` directo desde el Bash tool del arnés
(`open -a` o el binario a mano, heredando el entorno de la shell) hacía que la app se cerrara en
milisegundos, sin ventana, sin diálogo, sin entrada en `render-api.log` ni en `log show`, exit code 0.
Costó varias vueltas (crash reports, `spctl`, re-firmar, `ditto` vs `cp`) hasta encontrar la causa real:
el entorno de este arnés trae `ELECTRON_RUN_AS_NODE=1` seteado, y cualquier binario de Electron lanzado
heredando ese entorno arranca como proceso Node plano (sin GUI) en vez de como app — exactamente el
mecanismo que `apps/desktop/src/main/main.ts` usa a propósito para correr `render-api` embebido.

## Lección

Para lanzar la app empaquetada desde este arnés (verificación manual, no el e2e ya blindado), armar el
`env` del `spawn` a mano — nunca heredar `process.env` — con algo como
`{ HOME, PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin', USER, LOGNAME, TMPDIR }`
(el mismo patrón que ya usa `finderLaunchEnv()` en `apps/desktop/e2e/packaged-app-smoke.mjs`); `open -a`
tampoco es una salida segura porque en este arnés también puede heredar variables. Antes de sospechar de
la firma/empaquetado, chequear `echo $ELECTRON_RUN_AS_NODE` en la propia shell.

## Costo evitable

~20 minutos de diagnóstico (crash reports vacíos, `spctl --assess`, recopiar con `ditto`, reinstalar)
antes de aislar la variable de entorno como causa. `apps/desktop/e2e/packaged-app-smoke.mjs` ya resolvía
esto correctamente desde antes (por eso nunca fue un problema en CI/otros ciclos) — el costo fue no
recordar copiar ese mismo patrón para una verificación manual ad-hoc.

## Qué pasó (segunda lección, aceptación del coordinador)

El coordinador pidió repetir el `kill -9` de huérfanos contra el `.dmg` **instalado** de verdad (no
sólo unit tests), y además una segunda variante: matar `render-api` directamente (no la app). Esa
segunda variante reveló dos bugs reales que ningún test con mocks había atrapado: (1) para cuando
Electron reacciona al `exit` de `render-api`, `chrome-headless-shell` ya fue reparentado por el SO a
`launchd` (`ppid=1`) — un filtro por `ppid === pidDelPadreMuerto` nunca matchea nada, porque ese pid ya
no es el padre real de nadie en el momento del chequeo; (2) la limpieza async se disparaba con
`void killOrphanableChromeChildren(...)` (fire-and-forget) inmediatamente antes de
`dialog.showMessageBoxSync`, que es **síncrono y bloqueante** — bloqueaba el event loop antes de que el
callback del `ps` asíncrono pudiera siquiera correr, así que la limpieza jamás pasaba.

## Lección

Para matar un huérfano cuyo padre YA murió, filtrar por **comando** (un path de binario único, no
genérico), nunca por `ppid` — el reparenting a `launchd` es inmediato e irreversible, así que cualquier
chequeo posterior a la muerte del padre ve `ppid=1`. Y: nunca dispares limpieza async justo antes de una
llamada síncrona bloqueante (`showMessageBoxSync`, `execSync` largo, etc.) esperando que "ya va a correr
en algún momento" — si el flujo sigue síncrono inmediatamente después, el event loop nunca le da la
vuelta; hace falta `await` explícito antes de la llamada bloqueante.

## Costo evitable

Dos reconstrucciones + reinstalaciones completas del `.dmg` (~5 min cada una) para descubrir esto,
porque el gap sólo se manifiesta con procesos reales del SO (no es simulable con mocks de `ps`/timers
en un unit test) — exactamente el tipo de bug que la skill de verificación empírica busca atrapar antes
de que llegue a un usuario real. Vale la pena, para cualquier limpieza de huérfanos futura, escribir el
caso "el que muere es el hijo directo, no el nieto" como su propio escenario de prueba real, no asumir
que el mismo código que funciona para "el padre murió" funciona igual al revés.
