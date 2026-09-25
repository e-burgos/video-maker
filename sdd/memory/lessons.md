# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.8 | Última destilación: 2026-09-24 (fix-e-burgos-001-003, spec-e-burgos-017-desktop-app cycle-01, cycle-02, cycle-03, cycle-05)
> **Cap duro: 120 líneas.** Se lee COMPLETO al inicio de cada sesión: cada línea cuesta tokens en
> todas las futuras. Al destilar, primero podar lo obsoleto o ya absorbido por constitutions/skills.

Una lección por línea, accionable, empezando por el verbo; la narrativa vive en `journal/` y acá no
se edita nada durante un ciclo/fix. Lo de un subproyecto va a su `constitution.md`; acá lo transversal.

## Proceso (cómo trabajan los agentes en este repo)

- Emitir SIEMPRE el registro de máquina antes que el documento narrativo (`tasks.json` antes que
  `planner.md`/`plan.md`): si la corrida se corta, el ciclo queda arrancable.
- Cerrar toda edición a mano de un `*.json` de `sdd/` corriendo `pnpm sdd:validate` en el acto.
- Escalar al dev con el diff cualquier config protegida por el hook `config-protection`
  (`eslint.config.mjs`, `tsconfig.base.json`): cubre `Write|Edit` pero NO `Bash` (rodearlo anula el guardrail), matchea por **basename**, y lo bloqueado se descopa por escrito en el plan.
- Derivar el `depends_on` de cada task de los **imports que ya están en las firmas escritas**, no
  del agrupamiento por historia: dos historias distintas se acoplan por un símbolo compartido.
- Cuando un RF describe cómo componer algo que otra lib ya entregó, derivar el contrato de la
  función real declarando la divergencia: la letra del RF puede especificar un defecto semántico.
- `grep` los **lectores** de un campo antes de editarlo (si el consumidor real lee otro derivado, editar el declarativo es un no-op que tipos, schema, disco y un `200` confirman) y los **productores** antes de dar default a un flag que elige entre dos fuentes, fijando la paridad contra el productor real, no contra el RF; mismo principio al sumar una fuente nueva a un renderer/mezclador.
- Tratar el `files[]` como checklist de cierre y trazar cada CA al archivo que **emite** el valor
  que nombra, no al que nombra la operación: si un CA cita un literal, el spec hermano de ese
  archivo es obligatorio en la lista cerrada y en el `files[]`.
- Verificar cada CA por el **símbolo que invoca su test**, no por el título del `it` (un helper
  anterior de forma parecida hace pasar el criterio), contrastar el diff contra la lista de tests
  obligatorios uno por uno, y leer `coverage.include` antes de confiar en un piso.
- Aserar todo payload nuevo con `Object.keys(body).sort()` contra la interfaz del contrato, nunca
  campo por campo contra lo que el handler ya emite: eso no verifica nada (dos endpoints
  devolvieron dos formas de la misma entidad con 215 tests en verde).
- Verificar que un error tipado PUEDE dispararse antes de darlo por implementado: un guard sobre una
  condición imposible es código muerto con nombre de validación.
- Un CA aceptado como "procedimiento documentado, nunca ejecutado" **no está verificado**: correr
  el guion de ejecución real en la **primera** task que deja el binario arrancable, no al cerrar.
- Cuando el invariante es "la salida no cambia", usar como oráculo byte-exacto el artefacto que NO embebe reloj de pared (`edl.json`; nunca `catalog`/`timeline`, con `probedAt`/`modifiedAtMs`), comparar los demás sin los campos volátiles, y **probar el oráculo sensible** rompiéndolo aposta.
  Sobre `media/`, replanificar antes de comparar en vez de re-renderizar lo que ya está en disco, y reproducir con el código base todo oráculo heredado de otro ciclo antes de usarlo como criterio.
- Committear todo guion que produjo una evidencia junto al artefacto que la reporta: un artefacto
  cuyo productor quedó en un scratchpad documenta un número, no una medición repetible.
- Verificar que el símbolo EXISTE (grep de la definición) después de toda edición scriptada por
  patrón: un `replace` que no matchea es silencioso y ni `node --check` ni el linter ven un
  identificador faltante — lo descubre la primera corrida cara.
- Parsear la salida de una herramienta de medición siempre desde su bloque de resumen, y sospechar de inmediato cuando dos entradas distintas dan el mismo número.
- En una migración transversal del texto que asera la suite (p. ej. introducir i18n), hacer que el
  default sin provider/config devuelva el valor de HOY: la suite existente prueba que nada cambió.
- Nunca tapar un defecto reescribiendo a mano un artefacto derivado (p. ej. `voice.words.json` con tiempos inventados) para destrabar una corrida: esconde el defecto y se repite en la próxima — el fix va siempre al productor real del artefacto, no al artefacto.
- Una decisión editorial que varía por tipo de contenido (p. ej. `captionStyle`) se persiste en el documento (timeline), nunca como flag del render: se decide una vez, se edita, y el render la lee de ahí.
- Forzar `NODE_ENV=production` en los comandos de build sin heredarlo del `.env` raíz, medir el peso real de la carga inicial sumando `index.js` y todo lo que precarga `index.html` (no solo el archivo que dispara el aviso de tamaño), y abrir la captura que respalda cada "verificado" antes de aceptarlo — un implementor puede reportar verificado sin que su propia captura muestre lo esperado.

## Técnica (stack, herramientas, gotchas transversales)

- No dar por verde nada sin correr `nx run-many -t lint test build`: `sdd:validate` no compila y
  Vitest no tipa (un `const facts = [media.kind]` rompió `build` con `test` verde).
- Verificar para qué runtime está tipado un proyecto antes de leer archivos desde un test/spec: un
  `node:fs` en uno tipado para navegador no compila aunque Vitest no tipe specs.
- Ejecutar un `.ts` suelto con `node -r @swc-node/register` (CJS) **acotado a TypeScript** (patrón
  `cli-register.cjs`): el hook ESM no anda acá y el loader `.js` de swc panica sin nombrar archivo.
- Declarar el alias `@video-maker/*` de una lib en los **TRES** resolvedores cuando otra lib importa
  un valor: `tsconfig.base.json → paths` (tsc), `resolve.alias` de `vite.config.ts` (Vitest) y
  `webpackOverride` de `@remotion/bundler` (render) — verde en los tres targets no prueba nada.
- Nunca copiar el union de códigos de error de otra lib: derivarlo con `import type` o un type guard
  sobre una lista propia `as const`, y **abrir el union antes de nombrar un `code` ajeno** en un
  contrato para verificar que exista (`VOICE_TRACK_NOT_MIRRORED` no existía: costó tres tasks).
- Ensanchar un tipo suma (unión discriminada, enum, result kind) es un cambio **global** que ningún
  `files[]` acota: correr el `build` del subproyecto y tratar la exhaustividad como parte de la task.
- Tipar los fixtures contra el tipo de producción: los specs no se typechequean (`tsconfig.lib.json`
  los excluye) y un fixture sin discriminante cuelga con `lint`/`build` en verde, nunca un guard de runtime.
- Pasar la raíz junto al documento en todo puerto cuyo input lleve paths **relativos** (`projectRoot`
  + `runOptions.cwd`): el doble no los resuelve, y si la función que lo invoca hace I/O propio, todo
  path que cruza el puerto va **absoluto** (el test asera la FORMA del path, no que el doble lo recibió).
- Buscar los fixtures que terminan en `...overrides` al ensanchar un tipo compartido: el spread
  esconde de `tsc` la propiedad faltante y el fallo aparece recién en runtime.
- Copiar a un fixture E2E solo lo que el escenario necesita, filtrando documentos de estado
  (`conversation.json`, `session.json`): clonar material vivo hereda el estado de otra corrida.
- Verificar un parámetro de **query string** contra el servidor real (test que levanta el socket),
  nunca contra el handler con ruta escrita a mano: un parser en el medio puede estar descartándolo.
- Verificar un exit code exacto invocando el **binario**, nunca vía `nx run` (Nx normaliza todo
  fallo a `1`), y sabiendo que `@remotion/renderer` instala sus propios handlers de señal: tras un
  render, `SIGTERM` da `143` aunque el server cierre limpio, y `process.exit(0)` no lo cambia.
- Comparar la duración de un render contra el **stream de video** (`nb_frames`/`r_frame_rate`),
  nunca contra `format.duration` (máximo entre streams, inflado por el padding AAC).
- Largar un render, síntesis o transcripción solo sin otro proceso `ffmpeg`/`whisper-cli`/`chrome-headless`
  vivo y con memoria libre de sobra: nunca dos jobs pesados a la vez.
- Verificar una UI midiendo en el navegador el estado del medio (`readyState` 4, `duration`,
  `videoWidth/Height`), nunca la captura ni el `src`: un `src` armado y un 404 se ven igual.
- El nombre accesible de un control con `aria-label` **es** el `aria-label`: verificarlo en el DOM
  real antes de un locator por rol+nombre — el texto visible deja de ser buscable.
- Cargar un binario o paquete nativo con `await import()` dentro del método que lo usa, no en el tope
  del módulo, y nunca mezclar `import` estático y `await import()` de la misma lib: `@nx/enforce-module-boundaries` lo prohíbe.
- Verificar con un test el orden de claves de `JSON.stringify` tras un `.parse()` de Zod cuando un CA
  depende de bytes idénticos, e inyectar un `Clock` fijo en la ingesta para comparar entre corridas.
- Versionar en el **nombre** del archivo todo caché cuyo contenido dependa de una constante del
  código (`<clave>.v1.wav`): el `mtime` del insumo no ve un cambio que sólo tocó quien lo produce.
- Verificar que una herramienta externa **aplicó** un contrato mirando el campo que sólo aparece si
  lo aplicó (`structured_output`), nunca su código de éxito (`claude -p --json-schema` ignora un
  schema con `$schema` y devuelve `is_error: false`): sondear con el artefacto real, no uno a mano.
- Nunca transcribir con whisper.cpp una pista con silencios largos de una sola pasada: `-ml 1` atribuye el hueco al token anterior y estira la última palabra hasta la frase siguiente; transcribir por segmento corto (una frase por wav) y acotar cada palabra a su ventana conocida (`[startMs, endMs]`).
- Nunca repartir palabras "omitidas" de una alineación de transcripción sobre un hueco sin tope: acotar el reparto a ~1,5 s pegado al run anterior, o alinear línea a línea contra el manifiesto de voz cuando existe — cruzar de frase sobre un silencio largo es el defecto, no un detalle cosmético.
- Nunca cerrar con `atrim=end=<T>` una mezcla que sale de `amix` con `loudnorm` en modo dinámico: el PTS no coincide con las muestras y corta el final — usar `apad=whole_dur=<T>` y dejar que el `-shortest` del mux marque el largo real.
- Probar cada tool MCP nueva leyendo el `tool_result` que ve el MODELO en el `stream-json` del CLI, no la respuesta del servidor: `outputSchema` tapa los bloques de imagen, y un input que no es `z.object` en la raíz llega vacío al modelo.
- Levantar el servidor con su loader real (p. ej. `@swc-node/register`) en la misma task que suma un paquete CJS o nativo: `tsc` y Vitest/esbuild resuelven el default import distinto que el loader de producción, y solo el arranque real lo detecta.
- Al lanzar una app Electron empaquetada desde este arnés (verificación manual, no el e2e ya blindado), armar el `env` del spawn a mano en vez de heredar `process.env` (trae `ELECTRON_RUN_AS_NODE=1`, que hace arrancar cualquier binario Electron como Node headless sin GUI); y para matar un huérfano cuyo padre ya murió, filtrar por **comando** (no por `ppid`: el reparenting a `launchd` es inmediato) y nunca disparar limpieza async fire-and-forget justo antes de una llamada síncrona bloqueante (`showMessageBoxSync`) sin `await` explícito antes.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Capturar `subagent_tokens` de cada notificación en el momento (única medición exacta gratuita); el
  `usage` de la task es el **delta** contra la anterior y el split 85/15 da `tokens_in`/`tokens_out`.
- Reanudar al mismo implementador con `SendMessage` task tras task en vez de relanzar uno nuevo
  (~45 k vs ~120 k por task).
- Poner el gate barato del guion E2E DESPUÉS del código que se quiere validar, no antes: un probe
  sólo verifica lo que corre de su lado del `return`, y lo que quedó atrás se paga con la corrida cara.
- Reusar el proyecto que una corrida cara ya produjo para capturar toda la evidencia visual que
  falte: relanzar la app contra esa copia no gasta un token y prueba la UI de verdad.
- Sembrar el artefacto caro desde una corrida anterior y validar la mecánica del guion con esa sonda
  barata ANTES de la primera corrida E2E completa (20 s vs ~70 s de `claude -p` y cuota), y hacer
  que el primer request del smoke pruebe que habla con el build bajo prueba —un campo de
  `capabilities` que sólo existe en el nuevo—, no que responde `200`.
