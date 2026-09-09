# Constitución — apps/render-api

> Versión 2.0 | Última actualización: spec-e-burgos-005 cycle-03 | Fecha: 2026-09-09
> Consolidada por el orquestador al abrir `cycle-01` de `spec-e-burgos-007-web-montage`
> (fundió los fragmentos de `spec-005` cycles 01-03).
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario, sin auth ni despliegue cloud)
- **Rol en el sistema:** expone por HTTP el motor de edición y el store de medios sobre `media/`:
  proyectos, assets crudos, `Timeline`/`EDL` persistidos, descarga de artefactos y una cola de jobs
  de render con progreso y cancelación. Es el único subproyecto que puede depender de
  `libs/media-local` y `libs/composition-remotion` a la vez (ver `context_prompt.md`).
- **Estado:** **completo y verificado contra binarios reales.** 15 rutas (`EP-001`..`EP-015`),
  37 códigos de error, 35 archivos de test / 307 tests, cobertura 96,79 % stmts · 89,69 % branch ·
  98,71 % funcs · 96,74 % lines (umbral 80 %).

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- **Cero dependencias npm propias** (D-2 de `spec-005`, sostenido en los tres ciclos): servidor
  sobre `node:http`, filesystem con `node:fs/promises`, paths con `node:path/posix`, ids con
  `node:crypto`. `apps/render-api` **no tiene `package.json` propio**: vive del manifiesto raíz.
- Workspace: `@video-maker/timeline-core` (tipos y schemas), `@video-maker/auto-montage`
  (proyecto de medios, catálogo, `Timeline`/`EDL` y sus escritores),
  `@video-maker/media-local` y `@video-maker/composition-remotion/render` — estas dos
  **exclusivamente por `await import()` dinámico dentro de
  `src/deps/node-render-api-dependencies.ts`**; en el resto del proyecto son `import type`.
- Vitest 4 sobre toda la lógica no-I/O, con alias a `src/` de las libs del workspace. La suite corre
  **sin** ffmpeg, ffprobe, whisper-cli ni Chrome.
- Tags Nx: `["scope:engine", "type:app"]`. Targets: `lint`, `test`, `build`, `serve`.
- **El alias de una lib del workspace hay que declararlo en CUATRO resolvedores:**
  `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts` de la app (Vitest),
  `webpackOverride` de Remotion (render), y **`SWC_NODE_PROJECT=tsconfig.base.json` en toda
  invocación directa del binario**. Sin la cuarta el proceso ni arranca, y `lint`/`test`/`build`
  verdes no lo detectan.

## 3. Convenciones

- **Una sola frontera de proceso** (`src/main.ts`): el único archivo que toca `process`, `console` y
  las señales del sistema. Invariante verificado por grep al cerrar cada ciclo: `process.`,
  `console.`, `node:fs` y `node:crypto` sólo aparecen en `src/main.ts` y
  `src/deps/node-render-api-dependencies(.spec).ts`.
- **Todo el I/O entra por puertos inyectables** (`RenderApiDependencies`), armados en un único
  adaptador de producción `createNodeRenderApiDependencies(env, store)`. **No hay puerto de
  borrado:** conservar los intermedios (D-8) es una propiedad del tipo, no una decisión de runtime.
- **Puertos vs estado vivo, explícito:** `RenderApiDependencies` son puertos **sin estado**;
  `RenderApiRuntime` (`src/http/render-api-runtime.ts`) es el estado vivo por servidor (`jobs`,
  `uploadSerializer`) y es el cuarto parámetro obligatorio de `handleRequest`. **Ningún estado de
  módulo sobrevive en el subproyecto** (D-23).
- **El orden del pipeline no es conmutable**: `renderTimeline(..., { audio: 'muted' })` →
  `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. El render mudo es obligatorio: sin
  él, el entregable sale con el audio de Remotion **encima** de la mezcla masterizada.
- **Todo payload de máquina en inglés** (D-4): `code`, `stage`, `resource`, `expected`, `hint`.
  Ningún payload expone `.stack`, rutas absolutas del host, ni el `message` de una lib que lleve la
  ruta de un binario. `toErrorPayload` omite los campos nulos en vez de emitir `null`.
- **La traducción de errores es estructural por `code`**, nunca por `instanceof` de la lib
  (`translateEngineError`, `translateStoreError`).
- **Cada ruta del pipeline lleva su par `{ path, resource }`**: `path` es de filesystem, `resource`
  es relativo al proyecto y es lo único que puede salir en un payload.
- **`withinTolerance: false` no es un fallo** (D-7): se publica el entregable y se reporta el delta.
- **`publicDir` = raíz del proyecto de medios, nunca `raw/`**; los intermedios van a
  `work/renders/<renderId>/` y el entregable a `out/<renderId>.mp4`.
- **Toda ruta se confina a `mediaRoot`**: la que se escape es `ASSET_PATH_INVALID`.
- **Un path relativo nunca viaja solo:** todo puerto cuyo input lleve paths relativos recibe también
  la raíz (`projectRoot` + `runOptions.cwd`, D-30). Sin eso el binario los resuelve contra el cwd
  del proceso de la API y ninguna suite lo ve.
- **`apps/render-api/eslint.config.mjs` no existe** (D-9): el hook `config-protection` del harness
  del dev bloquea cualquier archivo de ese basename y rodearlo con `Bash` anularía el guardrail.
  `@nx/eslint:lint` resuelve el flat config de la raíz, así que el proyecto sí se lintea y los
  boundaries se cumplen por el fallback de `type:app`. El bloque propuesto (`architect.md` de
  `cycle-01` §8.2) acumula tres correcciones y **no se puede pegar tal cual**.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- **El guion copiable de verificación real vive en `apps/render-api/README.md`**, nunca sólo en un
  `architect.md`: los de `spec-005` §13 no arrancan copiados tal cual (les falta
  `SWC_NODE_PROJECT`, y su `pgrep` matchea el navegador del dev).
