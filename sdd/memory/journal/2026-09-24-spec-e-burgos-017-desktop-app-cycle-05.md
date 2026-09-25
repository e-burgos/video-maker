# spec-e-burgos-017-desktop-app cycle-05 — 2026-09-24

## Qué pasó
Dos hallazgos del mismo tipo: una cosa se daba por cierta y la evidencia decía otra. (1) El build de producción de
la web salía con React de desarrollo desde siempre: el `.env` raíz trae `NODE_ENV=development`, Nx lo inyecta en
todas las tasks y Vite respeta un `NODE_ENV` ya seteado; lo mismo pasaba con el bundle esbuild de render-api. El
aviso de 500 kB parecía resuelto porque Rollup partía el mismo peso en dos archivos precargados. (2) Un implementor
reportó "verificado" el flujo de tarjetas de propuesta, pero su propia captura no mostraba ninguna tarjeta.

## Lección
Medir el peso real de la carga inicial sumando `index.js` y todo lo que `index.html` precarga, forzar
`NODE_ENV=production` en los comandos de build (nunca heredarlo del `.env`), y abrir la captura que respalda cada
"verificado" antes de aceptarlo.

## Costo evitable
Tres rondas de devolución de diseño que habrían sido una si el implementor hubiera mirado sus capturas; todas las
builds anteriores de la app de escritorio salieron con React de desarrollo.
