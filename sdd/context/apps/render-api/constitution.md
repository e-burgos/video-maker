# Constitución — apps/render-api

> Versión 3.1 | Última actualización: FIX-e-burgos-015-002 | Fecha: 2026-09-11
> Consolidada al abrir `cycle-01` de `spec-e-burgos-016-studio-usability` (fundió los fragmentos de
> `FIX-015-001`, `FIX-007-001`, `FIX-007-002`, `FIX-008-001`, `FIX-009-001` y `FIX-015-002`).
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario, sin auth ni despliegue cloud)
- **Rol en el sistema:** expone por HTTP el motor de edición y el store de medios sobre `media/`:
  proyectos, assets crudos, `Timeline`/`EDL` persistidos, storyboard, voz, descarga de artefactos,
  una cola de jobs con progreso y cancelación, y el **productor conversacional**. Es el único
  subproyecto que puede depender de `libs/media-local` y `libs/composition-remotion` a la vez (ver
  `context_prompt.md`).
- **Estado:** **completo y verificado contra binarios reales.** 25 rutas (`EP-001`..`EP-025`),
  83 códigos de error, 74 archivos de test / 895 tests, cobertura 98,09 % stmts · 92,70 % branch
  (umbral 80 %).

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- **Cero dependencias npm propias** (D-2 de `spec-005`, sostenido en todos los ciclos): servidor
  sobre `node:http`, filesystem con `node:fs/promises`, paths con `node:path/posix`, ids con
  `node:crypto`, proceso hijo del productor con `node:child_process`. `apps/render-api` **no tiene
  `package.json` propio**: vive del manifiesto raíz.
- Workspace: `@video-maker/timeline-core` (tipos y schemas), `@video-maker/auto-montage`
  (proyecto de medios, catálogo, `Timeline`/`EDL` y sus escritores),
  `@video-maker/media-local` y `@video-maker/composition-remotion/render` — estas dos
  **exclusivamente por `await import()` dinámico dentro de
  `src/deps/node-render-api-dependencies.ts`**; en el resto del proyecto son `import type`.
- **Binarios externos**, todos por puertos inyectables y ninguno en `package.json`: `ffmpeg`,
  `ffprobe`, `whisper-cli` + su modelo, `piper` + su voz `.onnx`, y `claude` (Claude Code CLI, **sin
  API key**: usa la suscripción de la máquina) para el storyboard y para el productor.
- Vitest 4 sobre toda la lógica no-I/O, con alias a `src/` de las libs del workspace. La suite corre
  **sin** ffmpeg, ffprobe, whisper-cli, piper, claude ni Chrome, y sin red.
- Tags Nx: `["scope:engine", "type:app"]`. Targets: `lint`, `test`, `build`, `serve`.
- **El alias de una lib del workspace hay que declararlo en CUATRO resolvedores:**
  `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts` de la app (Vitest),
  `webpackOverride` de Remotion (render), y **`SWC_NODE_PROJECT=tsconfig.base.json` en toda
  invocación directa del binario**. Sin la cuarta el proceso ni arranca, y `lint`/`test`/`build`
  verdes no lo detectan.

## 3. Convenciones

- **Una sola frontera de proceso** (`src/main.ts`): el único archivo que toca `process`, `console` y
  las señales del sistema. Invariante verificado por grep al cerrar cada ciclo: `process.`,
  `console.`, `node:fs`, `node:crypto` y `node:child_process` sólo aparecen en `src/main.ts` y
  `src/deps/node-render-api-dependencies(.spec).ts`.
- **Todo el I/O entra por puertos inyectables** (`RenderApiDependencies`), armados en un único
  adaptador de producción `createNodeRenderApiDependencies(env, store)`. **No hay puerto de
  borrado:** conservar los intermedios (D-8) es una propiedad del tipo, no una decisión de runtime.
- **Puertos vs estado vivo, explícito:** `RenderApiDependencies` son puertos **sin estado**;
  `RenderApiRuntime` (`src/http/render-api-runtime.ts`) es el estado vivo por servidor (`jobs`,
  `producerTurns`, `producer`, `uploadSerializer`) y es el cuarto parámetro obligatorio de
  `handleRequest`. **Ningún estado de módulo sobrevive en el subproyecto** (D-23).
- **Los jobs son una unión discriminada por `kind`** (`render` · `montage` · `storyboard` · `voice`)
  con etapas propias por tipo. Agregar un miembro rompe la exhaustividad en **todos** los call
  sites, incluidos handlers que la task en curso no lista: es la red de seguridad, no un costo.
- **El modelo de IA viaja por request, no por arranque**: `POST …/producer/messages` y los jobs
  `storyboard`/`voice` aceptan `model?`, validado contra `runtime.producer.models`
  (`PRODUCER_MODEL_INVALID` / `JOB_MODEL_INVALID`, 422). El productor lo persiste en `session.json`,
  lo informa en el turno y lo inyecta como **valor concreto** en el system prompt. El agente de
  storyboard nunca se invoca sin `--model` (`CLAUDE_CLI_MODEL` default `sonnet`,
  `AiAgentConfig.model` no nullable); el job `voice` valida el campo y lo descarta, porque la
  síntesis es local.
- **El job `montage` parametriza formato y fuente de habla**: `format` (los cuatro `OutputPreset`,
  default `reels-9x16`) y `voice: 'aroll' | 'script'` (default `aroll`), los dos validados **antes**
  de registrar el job — `script` sin `work/voice/voice.wav` es `409 MONTAGE_VOICE_TRACK_NOT_FOUND`.
  `voice` está **sobrecargado por `kind`**: en un job `voice` es el id del modelo Piper, en un
  `montage` es la fuente de habla.
- **El job `voice` tiene dos entradas**: el storyboard, o un guion suelto (`scriptText` XOR
  `scriptPath`, una frase por línea, más `gapMs` default 900) que sintetiza un wav por frase, los
  concatena en `work/voice/voice.wav` (48 kHz mono) y los describe en
  `work/voice/script-manifest.json` con `source: 'script'`. Los paths de la pista de guion se
  **re-exportan de `@video-maker/auto-montage`**, que es quien también los lee desde el montaje.
- **La lista blanca de herramientas del productor no es global**: `producerAllowedTools(piperPath)`
  la arma por turno y viaja en `ProducerTurnStart.allowedTools`. Agregar un binario obliga a
  sondearlo contra el CLI real antes de escribirlo en la lista.
- **El turno del productor NO es un job** (D-1 de `spec-015`): el agente encola `montage`/`render`
  en esta misma API y espera su resultado, así que dentro de una cola de concurrencia 1 se
  bloquearía solo. Vive en `producerTurns`, la exclusión es **por proyecto** y la cancelación
  **mata el proceso hijo** en vez de ser cooperativa.
- **La cancelación de un job es cooperativa y el estado vigente gana sobre el resultado del
  pipeline**: cancelar durante `verify` da `canceled` con `report: null` aunque el MP4 exista. Los
  checkpoints van **entre** llamadas opacas, nunca dentro de una.
- **El orden del pipeline no es conmutable**: `renderTimeline(..., { audio: 'muted' })` →
  `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. El render mudo es obligatorio: sin
  él, el entregable sale con el audio de Remotion **encima** de la mezcla masterizada.
- **Todo payload de máquina en inglés** (D-4): `code`, `stage`, `resource`, `expected`, `hint`.
  Ningún payload expone `.stack`, rutas absolutas del host, ni el `message` de una lib que lleve la
  ruta de un binario, ni el `stderr` de un proceso externo. `toErrorPayload` omite los campos nulos
  en vez de emitir `null`.
- **La traducción de errores es estructural por `code`**, nunca por `instanceof` de la lib
  (`translateEngineError`, `translateStoreError`, `translateMontageError`, `translateVoiceError`).
  El fallo de un proceso externo es `502`, no `500`.
- **Cada ruta del pipeline lleva su par `{ path, resource }`**: `path` es de filesystem, `resource`
  es relativo al proyecto y es lo único que puede salir en un payload.
- **`withinTolerance: false` no es un fallo** (D-7): se publica el entregable y se reporta el delta.
- **`publicDir` = raíz del proyecto de medios, nunca `raw/`**; los intermedios van a
  `work/renders/<renderId>/` y el entregable a `out/<renderId>.mp4`.
- **Toda ruta se confina a `mediaRoot`**: la que se escape es `ASSET_PATH_INVALID`.
- **Todo path que cruza a un puerto de media va ABSOLUTO** (D-30 y D del `cycle-01` de `spec-009`):
  pasar `projectRoot` como `cwd` alcanza para el binario pero **no** para el wrapper, que lee su
  JSON con `readTextFile` contra el cwd del proceso de la API.
- **Los artefactos de `work/` se escriben con los escritores de `auto-montage`**
  (`serializeMontageDocument`, `writeTimeline`, `writeEditDecisionList`), nunca con un
  `JSON.stringify` propio: es lo que sostiene la paridad byte a byte con la CLI (D-16).
- **`apps/render-api/eslint.config.mjs` no existe** (D-9): el hook `config-protection` del harness
  del dev bloquea cualquier archivo de ese basename y rodearlo con `Bash` anularía el guardrail.
  `@nx/eslint:lint` resuelve el flat config de la raíz, así que el proyecto sí se lintea y los
  boundaries se cumplen por el fallback de `type:app`.
- **Los `*.spec.ts` NO se typechequean** (`tsconfig.lib.json` los excluye y Vitest no tipa): un
  fixture sin discriminante cae en la rama equivocada con `lint` y `build` en verde. Tipar los
  fixtures contra el tipo de producción, nunca compensarlo con un guard de runtime.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- **El guion copiable de verificación real vive en `apps/render-api/README.md`**, nunca sólo en un
  `architect.md`.
