# spec-e-burgos-001-core-composition-media-pipeline cycle-01 — 2026-09-07

## Qué pasó

1. **El generador `@nx/js:lib` de Nx 23 deja targets inferidos que cuelgan el comando de
   verificación.** `--unitTestRunner=vitest` ya no usa `@nx/vite`: registra el plugin
   `@nx/vitest` en `nx.json`, cuyo target `test` inferido corre `vitest` en **modo watch**.
   `nx run-many -t test` quedó colgado fuera de CI. También registró `@nx/eslint/plugin`,
   duplicando el `lint` explícito que usa el resto del repo. Hubo que sacar ambos plugins de
   `nx.json` y declarar `test`/`build` explícitos en `project.json`.
2. **`node --import @swc-node/register/esm-register script.ts` no funciona en este repo.** Sin
   `"type": "module"` en ningún `package.json`, el `resolve()` del hook ESM clasifica cada `.ts`
   local como `commonjs` y el interop revienta con `SyntaxError: does not provide an export
   named 'X'` en un import trivial. `node --experimental-strip-types` tampoco sirve: exige
   extensión explícita en cada especificador, y el repo importa sin extensión.
3. **`z.toJSONSchema(registry)` inventa un documento `__shared`.** Cuando dos schemas del
   registry reusan la misma subestructura Zod (acá `z.json()` recursivo), Zod la extrae a un
   documento sintético `__shared` y la referencia con `$ref: "__shared.schema.json#/$defs/…"`.
   No hay flag público para desactivarlo (`reused: 'inline'` solo aplica dentro de un mismo
   documento). Se descubrió leyendo el fuente de Zod, después de que el test anti-drift fallara
   por un 7.º archivo que nadie había pedido.

## Lección

- Después de scaffoldear con un generador de Nx, revisar el diff de `nx.json` y correr
  `nx run-many -t lint test build` completo antes de dar el scaffold por bueno: los targets
  inferidos por plugin pueden traer modo watch o duplicar targets del repo.
- Para correr un `.ts` con `node` en este repo usar `node -r @swc-node/register` (registro CJS),
  no el hook ESM ni `--experimental-strip-types`.
- Al generar JSON Schema desde un **registry** Zod, post-procesar la salida para inlinear los
  `$ref` al documento `__shared`, o el set de archivos generados no coincide con el commiteado.

## Costo evitable

- Las tres se descubrieron ejecutando y fallando (la 2 y la 3 dentro de TASK-011, la task más
  cara del ciclo: 238K tokens y 132 tool uses, ~2× la mediana). Un `nx run-many` inmediato
  después del scaffold y elegir el registro CJS de entrada habrían ahorrado buena parte de esa
  iteración; el `__shared` de Zod no era anticipable sin leer el fuente, pero sí barato de
  reconocer si se sabe que existe.
