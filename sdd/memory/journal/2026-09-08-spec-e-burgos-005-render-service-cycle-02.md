# spec-e-burgos-005-render-service cycle-02 — 2026-09-08

## Qué pasó

1. **El alias `@video-maker/*` necesita un CUARTO resolvedor.** `lessons.md` ya registra los tres
   (`tsconfig.base.json → paths`, `resolve.alias` de Vitest, `webpackOverride` de Remotion) y
   registra `SWC_NODE_PROJECT` sólo para targets `nx:run-commands` con `cwd` de proyecto. El guion
   de verificación por ejecución real de `architect.md` §13 invoca el binario **directamente**
   (`node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts` desde la raíz)
   y ahí `SWC_NODE_PROJECT=tsconfig.base.json` también es obligatorio: sin él el proceso no arranca.
   `pnpm nx run-many -t lint test build` quedó verde en los 8 proyectos y la suite de 215 tests
   también: **ninguna de las dos compuertas ve este fallo**. Sólo lo vio ejecutar el proceso.
   El guion salió mal escrito del architect y se copió así al README; se corrigió el README
   (el entregable de CA-020) y el architect quedó divergente a propósito.

2. **Un test que asera contra lo que el handler produce no verifica ningún contrato.** El `201` del
   upload devolvía `{asset, fingerprint, role}` (el `CatalogAsset` crudo) donde `architect.md` §4.5
   exige el `AssetListEntry` `{path, role, fingerprint, media}` — dos formas distintas para la misma
   entidad según el endpoint. Las 215 pruebas pasaban: el spec del handler aseraba campo por campo
   contra lo que el handler ya emitía. Lo detectó el `curl` de §13 al mirar el payload real.
   Se corrigió con `toAssetListEntry` compartido entre `GET .../assets` y el `201`, y con una
   aserción de **claves exactas** (`Object.keys(body).sort()`) contra el documento.

## Lección

Una compuerta verde sólo prueba lo que la compuerta mira: el arranque real del proceso y la forma
exacta del payload contra el documento son evidencias que ni `build`, ni `lint`, ni una suite
escrita a partir de la implementación pueden producir.

## Costo evitable

Dos correcciones post-implementación sobre 20 tasks ya cerradas (~13K tokens de re-trabajo) más la
sesión de verificación manual. Ambas se evitaban con dos hábitos baratos: correr el guion de §13
**una vez, temprano** (en la primera task que deja el servidor arrancable, no al cerrar el ciclo), y
aserar todo payload nuevo con `Object.keys(...).sort()` contra la interfaz del architect en vez de
campo por campo contra lo que el handler devuelve.
