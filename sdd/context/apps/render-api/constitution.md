# Constitución — apps/render-api

> Versión 3.3 | Última actualización: consolidado hasta spec-e-burgos-017-desktop-app cycle-04 | Fecha: 2026-09-24
> Consolidada al cerrar `cycle-04` de `spec-e-burgos-017-desktop-app` (fundió los fragmentos de
> `FIX-009-004` y de `cycle-01`..`cycle-04`). Las actualizaciones por ciclo/fix van como fragmentos
> aditivos en `updates/`.

## 1. Propósito

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario, sin auth propia — opcionalmente
  detrás de un token de acceso cuando la empaqueta Electron; sin despliegue cloud)
- **Rol en el sistema:** expone por HTTP el motor de edición y el store de medios sobre `media/`:
  proyectos, assets crudos, `Timeline`/`EDL` persistidos, storyboard, voz, foto-a-roll, descarga de
  artefactos, una cola de jobs con progreso y cancelación, y el **productor conversacional** (MCP,
  con motor Claude CLI u OpenRouter). Es el único subproyecto que puede depender de
  `libs/media-local` y `libs/composition-remotion` a la vez (ver `context_prompt.md`).
- **Estado:** **completo y verificado contra binarios reales.** 41 rutas (`EP-001`..`EP-041`),
  112 códigos de error, 116 archivos de test, cobertura sostenida ≥ 80 % (umbral del proyecto).
  Corre tanto en dev (TypeScript vía `@swc-node/register`) como empaquetado (`render-api:bundle`,
  CJS) para Electron.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- **Cero dependencias npm propias** (D-2 de `spec-005`, sostenido en todos los ciclos): servidor
  sobre `node:http`, filesystem con `node:fs/promises`, paths con `node:path/posix`, ids con
  `node:crypto`, proceso hijo del productor con `node:child_process`. `apps/render-api` **no tiene
  `package.json` propio**. Las libs de las que depende sí traen las suyas (`better-sqlite3`/
  `drizzle-orm` vía `@video-maker/local-store`, `@modelcontextprotocol/sdk` vía
  `@video-maker/producer-tools`, este último no importado directo).
- Workspace: `@video-maker/timeline-core` (tipos/schemas), `@video-maker/auto-montage` (proyecto de
  medios, catálogo, escritores de `Timeline`/`EDL`), `@video-maker/local-store` (SQLite: proyectos,
  organización, conversación/sesión del productor, jobs, configuración), `@video-maker/producer-tools`
  (contrato/prompt del productor, servidor MCP `studio`), y `@video-maker/media-local` /
  `@video-maker/composition-remotion/render` — estas dos **exclusivamente por `await import()`
  dinámico** en `src/deps/node-render-api-dependencies.ts`; en el resto del proyecto son `import type`.
- **Binarios y servicios externos**, todos por puertos inyectables y ninguno en `package.json`:
  `ffmpeg`, `ffprobe`, `whisper-cli` + su modelo, un CLI de voz **sherpa-onnx** (`TTS_CLI_PATH` +
  `TTS_VOICES_DIR`, reemplazó a Piper), y `claude` (Claude Code CLI, **sin API key**) para el
  storyboard y, cuando el motor efectivo del productor es Claude, para el productor. El productor
  también corre contra **OpenRouter** (API HTTP, key en el llavero de macOS, nunca en un payload).
- Vitest 4 sobre toda la lógica no-I/O, con alias a `src/` de las libs del workspace. La suite corre
  **sin** ffmpeg, ffprobe, whisper-cli, el CLI de voz, claude, OpenRouter ni Chrome, y sin red.
- Tags Nx: `["scope:engine", "type:app"]`. Targets: `lint`, `test`, `build`, `serve`, `bundle`.
- **El alias de una lib del workspace hay que declararlo en CUATRO resolvedores:**
  `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts` (Vitest), `webpackOverride`
  de Remotion (render), y **`SWC_NODE_PROJECT=tsconfig.base.json` en toda invocación directa del
  binario en dev**. Sin la cuarta el proceso ni arranca, y `lint`/`test`/`build` verdes no lo
  detectan. El bundle empaquetado (CJS, workspace packages inlineados) no depende de esto.

## 3. Convenciones

- **Una sola frontera de proceso** (`src/main.ts`): el único archivo que toca `process`, `console` y
  las señales del sistema, salvo el watchdog del padre (`src/process/parent-watchdog.ts`, mata el
  árbol de procesos si `VIDEO_MAKER_PARENT_PID` desaparece — lo usa Electron). Verificado por grep al
  cerrar cada ciclo: `process.`, `console.`, `node:fs`, `node:crypto` y `node:child_process` sólo
  aparecen ahí y en `src/deps/node-render-api-dependencies(.spec).ts`.
- **Todo el I/O entra por puertos inyectables** (`RenderApiDependencies`), armados en un único
  adaptador de producción `createNodeRenderApiDependencies(env, store)`. **No hay puerto de
  borrado:** conservar los intermedios (D-8) es una propiedad del tipo, no una decisión de runtime.
- **Puertos vs estado vivo, explícito:** `RenderApiDependencies` son puertos **sin estado**;
  `RenderApiRuntime` (`src/http/render-api-runtime.ts`) es el estado vivo por servidor (`jobs`,
  `producerTurns`, `producer`, `uploadSerializer`), cuarto parámetro obligatorio de `handleRequest`.
  **Ningún estado de módulo sobrevive en el subproyecto** (D-23); la cola de jobs y la
  conversación/sesión del productor además persisten en SQLite (`deps.localStore`), sobreviviendo a
  un reinicio.
- **Los jobs son una unión discriminada por `kind`** (`render` · `montage` · `storyboard` · `voice` ·
  `photo-aroll`) con etapas propias por tipo. Agregar un miembro rompe la exhaustividad en **todos**
  los call sites, incluidos handlers que la task en curso no lista: es la red de seguridad, no un
  costo.
- **El productor rutea cada turno a un motor efectivo**, Claude CLI u OpenRouter, elegido por
  configuración (`EP-037`..`EP-040`); el adaptador OpenRouter emite el mismo protocolo `stream-json`
  que el CLI, así que persistencia y resúmenes de turno no distinguen motor. El storyboard **siempre**
  usa su propio agente Claude. **El modelo viaja por request, no por arranque**: `POST
  …/producer/messages` y los jobs `storyboard`/`voice` aceptan `model?`, validado contra
  `runtime.producer.models` (`PRODUCER_MODEL_INVALID` / `JOB_MODEL_INVALID`, 422); el agente de
  storyboard nunca se invoca sin `--model` (`CLAUDE_CLI_MODEL` default `sonnet`); el job `voice`
  valida el campo y lo descarta, porque la síntesis es local.
- **El job `montage` parametriza formato, fuente de habla y estilo de captions**: `format` (los
  cuatro `OutputPreset`, default `reels-9x16`), `voice: 'aroll' | 'script'` (default `aroll`) y
  `captionStyle` (`CaptionStyle | null`; `undefined` ⇒ `null`, decide el preset de montaje), los
  tres validados **antes** de registrar el job — `script` sin `work/voice/voice.wav` es
  `409 MONTAGE_VOICE_TRACK_NOT_FOUND`, un `captionStyle` fuera de `CAPTION_STYLES` es
  `422 MONTAGE_CAPTION_STYLE_INVALID`. `voice` está **sobrecargado por `kind`**: en un job `voice`
  es el id del modelo de voz, en un `montage` es la fuente de habla. `captionStyle` queda persistido
  en `work/timeline.json`, así que `PUT /projects/:slug/timeline` puede cambiarlo y un `render`
  pelado lo toma sin replanificar; `MontageJobReport` siempre lo resuelve.
- **El job `voice` tiene dos entradas**: el storyboard, o un guion suelto (`scriptText` XOR
  `scriptPath`, una frase por línea, más `gapMs` default 900) que sintetiza un wav por frase, los
  concatena en `work/voice/voice.wav` (48 kHz mono) y los describe en
  `work/voice/script-manifest.json` con `source: 'script'`. Los paths de la pista de guion se
  **re-exportan de `@video-maker/auto-montage`**, que es quien también los lee desde el montaje.
  **La transcripción es por línea** (`work/voice/whisper/line-NN.wav`), no del wav concatenado: las
  palabras de cada frase se desplazan al `startMs` de su placement y se acotan a su ventana; si
  Whisper falla o no deja palabras dentro, el texto de esa línea se reparte parejo.
  `voice.words.json` es la unión ordenada (`segments: []`). El guion entiende **marcas de tiempo**:
  `hasVoiceScriptTimeMarks` decide un flujo de dos pasadas
  (sintetizar a velocidad natural → planificar y decidir qué líneas acelerar → resintetizar sólo
  esas → planificar de nuevo con `allowSpeedUp: false`, que fija `startMs`/`endMs`/`overflowMs`); un
  guion sin marcas usa el flujo simple de siempre. El reporte del job **no** publica si era
  cronometrado ni el overflow total — se lee de `work/voice/script-manifest.json`.
- **El productor no tiene shell propio**: `claude -p` se lanza con `--tools ""`, `--strict-mcp-config`
  y un `--mcp-config` inline que arranca el servidor MCP `studio` de `libs/producer-tools`, acotado
  al proyecto (`--allowedTools mcp__studio`), `cwd` estable y vacío. Agregar una capacidad nueva es
  agregar una tool MCP, no ensanchar una lista blanca de `Bash`/rutas. `store/producer-writable-paths.ts`
  es la única puerta de rutas que el productor puede escribir (relativas, sin `..`, realpath dentro
  del proyecto aunque no exista; `work/producer/**` + `work/credits.json`).
- **El turno del productor NO es un job** (D-1 de `spec-015`): el agente encola `montage`/`render`/
  `photo-aroll` en esta misma API y espera su resultado, así que dentro de una cola de concurrencia 1
  se bloquearía solo. Vive en `producerTurns`, la exclusión es **por proyecto** y la cancelación
  **mata el proceso hijo** en vez de ser cooperativa.
- **La cancelación de un job es cooperativa y el estado vigente gana sobre el resultado del
  pipeline**: cancelar durante `verify` da `canceled` con `report: null` aunque el MP4 exista. Los
  checkpoints van **entre** llamadas opacas, nunca dentro de una.
- **El orden del pipeline no es conmutable**: `renderTimeline(..., { audio: 'muted' })` →
  `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. El render mudo es obligatorio: sin
  él, el entregable sale con el audio de Remotion **encima** de la mezcla masterizada.
- **Todo payload de máquina en inglés** (D-4): `code`, `stage`, `resource`, `expected`, `hint`.
  Ningún payload expone `.stack`, rutas absolutas del host, ni el `message` de una lib que lleve la
  ruta de un binario, ni el `stderr` de un proceso externo, ni una key de OpenRouter. `toErrorPayload`
  omite los campos nulos en vez de emitir `null`.
- **La traducción de errores es estructural por `code`**, nunca por `instanceof` de la lib
  (`translateEngineError`, `translateStoreError`, `translateMontageError`, `translateVoiceError`,
  `translateProducerError`). El fallo de un proceso externo es `502`, no `500`.
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
- **El store de assets también borra** (`EP-027`): mismo confinamiento y mismo mutex por slug que el
  upload (`runtime.uploadSerializer`), así que un delete nunca se intercala con una subida del mismo
  proyecto. `409 ASSET_IN_USE` si `work/timeline.json` lo referencia (`findTimelineAssetReferences`),
  salvo `?force=true`. **Nada se borra hasta que pasaron todas las verificaciones**: el catálogo se
  lee antes de tocar el disco. El borrado no conoce derivados (`work/renders/`, `work/edl.json`,
  `out/`): quedan huérfanos porque no hay índice inverso de artefacto → asset; sólo la transcripción
  del asset se limpia porque el catálogo la modela por asset.
- **`GET /projects/:slug/generated` (`EP-028`) es ciego al contenido**: recorre recursivamente
  `work/voice`, `work/producer` y `out` (`GENERATED_ROOTS`, ninguna otra raíz), no parsea ni borra;
  los bytes los sigue sirviendo `EP-011`. Una raíz ausente aporta cero entradas, nunca falla.
- **El catálogo de voces no infiere nada que el modelo no documente** (ni género, ni edad, ni
  carácter): `language`, `quality` y `label` salen del sidecar de cada voz bajo `TTS_VOICES_DIR`, y
  del nombre del archivo sólo cuando el sidecar falta o está corrupto. `GET /voices/:voiceId/preview`
  (`EP-026`) sintetiza una frase fija en español, la cachea fuera de `mediaRoot`
  (`voicePreviewCache` es un puerto propio, no `deps.storage`) e invalida por `mtime` del modelo —
  **no** por el código: bumpear `VOICE_PREVIEW_REVISION` es obligatorio al tocar la frase. El
  preview corre en un `createKeyedSerializer` por voz, **fuera de la cola de jobs**, mismo
  fundamento que el turno del productor.
- **El acceso HTTP es local por defecto, opcionalmente detrás de un token**: con
  `RENDER_API_ACCESS_TOKEN` seteado (empaquetado Electron), toda ruta exige la cookie `vm_session` o
  el header `x-studio-token` más un `Host` local (`http/local-access-guard.ts`); sin la variable no
  hay guardia. Con `RENDER_API_WEB_ROOT` seteada, el mismo proceso sirve la web estática y la API
  queda bajo `/api` (`GET /health` sin prefijo es la excepción). El entorno de un proceso hijo
  (`claude -p`, el servidor MCP, los binarios de media) **nunca es `process.env` completo**:
  `config/child-process-env.ts` arma la lista blanca.
- **El system prompt del productor exige decir en qué pantalla quedó cada artefacto** al entregar
  (`preview`/"Generated" para el video, `voice` para la narración, `storyboard` para el guion) y
  nunca contestar "dónde está" con una ruta. Para el logo, enseña a leer `pix_fmt` con
  `ffprobe -show_streams` y preferir el archivo con canal alfa cuando hay más de uno en
  `raw/logo/` — un PNG `rgba` con el arte sobre un recuadro blanco opaco pasa el filtro igual, así
  que el chequeo real lo hace el humano en el preview.
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
