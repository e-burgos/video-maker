# spec-e-burgos-017-desktop-app cycle-02 — 2026-09-23

## Qué pasó
`libs/local-store` importaba `better-sqlite3` con `import Database from 'better-sqlite3'`. `tsc`
(moduleResolution bundler) y Vitest (esbuild) lo aceptaban y la suite entera estaba en verde, pero el
servidor real, que corre con `@swc-node/register`, se caía al arrancar: `_bettersqlite3.default is not
a constructor`. La interop de swc para un CJS `export =` no es la de esbuild. Se resolvió con
`createRequire`. Solo apareció porque la task exigía levantar el servidor real.

## Lección
Levantar el servidor con su loader real (`server-register.cjs`) en la misma task que suma un paquete
CJS o nativo: `tsc` y Vitest resuelven su default import y swc no.

## Costo evitable
Ninguno esta vez: la regla de "chequeo real por task" lo atrapó antes de que otra task construyera
encima.
