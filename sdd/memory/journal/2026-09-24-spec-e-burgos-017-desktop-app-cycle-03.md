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
