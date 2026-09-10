# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.5 | Última destilación: 2026-09-10 (spec-009 c01-02, spec-014 c01, spec-015 c01-02)
> **Cap duro: 120 líneas.** Se lee COMPLETO al inicio de cada sesión: cada línea cuesta tokens en
> todas las futuras. Al destilar, primero podar lo obsoleto o ya absorbido por constitutions/skills.

Una lección por línea, accionable, empezando por el verbo; la narrativa vive en `journal/` y acá no
se edita nada durante un ciclo/fix. Lo de un subproyecto va a su `constitution.md`; acá lo transversal.

## Proceso (cómo trabajan los agentes en este repo)

- Emitir SIEMPRE el registro de máquina antes que el documento narrativo (`tasks.json` antes que
  `planner.md`/`plan.md`): si la corrida se corta, el ciclo queda arrancable.
- Cerrar toda edición a mano de un `*.json` de `sdd/` corriendo `pnpm sdd:validate` en el acto.
- Escalar al dev con el diff cualquier config protegida por el hook `config-protection`
  (`eslint.config.mjs`, `tsconfig.base.json`): cubre `Write|Edit` pero NO `Bash`, rodearlo anula el
  guardrail; matchea por **basename**, y lo bloqueado se descopa por escrito en el plan.
- Derivar el `depends_on` de cada task de los **imports que ya están en las firmas escritas**, no
  del agrupamiento por historia: dos historias distintas se acoplan por un símbolo compartido.
- Cuando un RF describe cómo componer algo que otra lib ya entregó, derivar el contrato de la
  función real declarando la divergencia: la letra del RF puede especificar un defecto semántico.
- `grep` los **lectores** de un campo antes de editarlo: si el consumidor real lee otro derivado
  (`audioMix.automation`, no `baseGainDb`), editar el declarativo es un no-op que tipos, schema,
  disco y un `200` confirman. Simétrico: leer quién **produce** un dato antes de dar default a un
  flag que elige entre dos fuentes, y fijar la paridad contra el productor real, no contra el RF.
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
- Cuando el invariante es "la salida no cambia", usar como oráculo byte-exacto el artefacto que NO
  embebe reloj de pared (`edl.json`; nunca `catalog`/`timeline`, con `probedAt`/`modifiedAtMs`),
  comparar los demás sin los campos volátiles, y **probar el oráculo sensible** rompiéndolo aposta.
- Committear todo guion que produjo una evidencia junto al artefacto que la reporta: un artefacto
  cuyo productor quedó en un scratchpad documenta un número, no una medición repetible.
- Verificar que el símbolo EXISTE (grep de la definición) después de toda edición scriptada por
  patrón: un `replace` que no matchea es silencioso y ni `node --check` ni el linter ven un
  identificador faltante — lo descubre la primera corrida cara.
- Reproducir con el código base todo oráculo heredado de otro ciclo antes de usarlo como criterio;
  si no reproduce, el baseline es un worktree del commit anterior.
- Parsear la salida de una herramienta de medición siempre desde su bloque de resumen, y sospechar
  de inmediato cuando dos entradas distintas dan el mismo número.

## Técnica (stack, herramientas, gotchas transversales)

- Verificar `NX_WORKSPACE_ROOT_PATH` antes de cualquier `nx …`: si apunta a otro repo, Nx ejecuta
  los targets de ESE repo sin error visible.
- No dar por verde nada sin correr `nx run-many -t lint test build`: `sdd:validate` no compila y
  Vitest no tipa (un `const facts = [media.kind]` rompió `build` con `test` verde).
- Ejecutar un `.ts` suelto con `node -r @swc-node/register` (CJS) **acotado a TypeScript** (patrón
  `cli-register.cjs`): el hook ESM no anda acá y el loader `.js` de swc panica sin nombrar archivo.
- Declarar el alias `@video-maker/*` de una lib en los **TRES** resolvedores cuando otra lib importa
  un valor: `tsconfig.base.json → paths` (tsc), `resolve.alias` de `vite.config.ts` (Vitest) y
  `webpackOverride` de `@remotion/bundler` (render) — verde en los tres targets no prueba nada.
- Nunca copiar el union de códigos de error de otra lib: derivarlo con `import type` o estrechar con
  un type guard sobre una lista propia `as const` — y **antes de nombrar un `code` ajeno en un
  contrato, abrir el union y verificar que exista** (`VOICE_TRACK_NOT_MIRRORED` no existía: costó
  re-alcanzar tres tasks). Al mergear ramas de specs, `nx run-many -t build` antes de commitear.
- Ensanchar un tipo suma (unión discriminada, enum, result kind) es un cambio **global** que ningún
  `files[]` acota: correr el `build` del subproyecto y tratar todos los errores de exhaustividad
  como alcance de la misma task.
- Tipar los fixtures contra el tipo de producción: los specs no se typechequean (`tsconfig.lib.json`
  los excluye, Vitest no tipa), y un fixture sin discriminante cae en la rama equivocada y cuelga
  con `lint`/`build` en verde — nunca compensarlo con un guard de runtime.
- Pasar la raíz junto al documento en todo puerto cuyo input lleve paths **relativos** (`projectRoot`
  + `runOptions.cwd`): el doble no los resuelve y sólo lo ve el primer binario real. `cwd` alcanza
  para el binario pero NO para el wrapper: si la función que lo invoca hace I/O propio, todo path
  que cruza el puerto va **absoluto**, y el test asera la FORMA del path, no que el doble lo recibió.
- Buscar los fixtures que terminan en `...overrides` al ensanchar un tipo compartido: el spread
  esconde de `tsc` la propiedad faltante y el fallo aparece recién en runtime.
- Sondear cada permiso de un agente externo con el comando real que se le va a permitir —uno por
  clase de efecto (leer, escribir, red, binario propio)— antes de escribir la lista blanca, y matar
  al proceso hijo al cerrar el servicio: un huérfano sigue escribiendo en el mismo directorio.
- Verificar un exit code exacto invocando el **binario**, nunca vía `nx run` (Nx normaliza todo
  fallo a `1`), y sabiendo que `@remotion/renderer` instala sus propios handlers de señal: tras un
  render, `SIGTERM` da `143` aunque el server cierre limpio, y `process.exit(0)` no lo cambia.
- Comparar la duración de un render contra el **stream de video** (`nb_frames`/`r_frame_rate`),
  nunca contra `format.duration` (máximo entre streams, inflado por el padding AAC).
- Largar un render, síntesis o transcripción solo sin procesos `ffmpeg`/`whisper-cli`/`piper`/
  `chrome-headless` vivos y con ≥ 35 % de memoria libre; nunca esperar `memory_pressure` en `normal`
  (nivel basal 2 en esta máquina) ni correr dos jobs pesados a la vez.
- Verificar una UI midiendo en el navegador el estado del medio (`readyState` 4, `duration`,
  `videoWidth/Height`), nunca la captura ni el `src`: un `src` bien armado y un 404 se ven igual. El
  MCP de Playwright no abre navegador acá; anda el de `~/.npm/_npx` con `channel: 'chrome'`.
- Cargar un binario o paquete nativo con `await import()` dentro del método que lo usa, no en el tope
  del módulo — y nunca mezclar `import` estático y `await import()` de la misma lib del workspace:
  `@nx/enforce-module-boundaries` lo prohíbe; el consumidor perezoso se mueve a un módulo propio.
- Verificar con un test el orden de claves de `JSON.stringify` tras un `.parse()` de Zod cuando un
  CA depende de bytes idénticos (no es el orden del literal), e inyectar un `Clock` fijo en la
  **ingesta** en todo test que compare bytes entre dos corridas del pipeline.
- Elegir al menos un valor distinto de cero por eje posicional en las fixtures: `f(0)` da 100 % de
  cobertura sin distinguir la fórmula correcta de casi ninguna.
- Verificar que una herramienta externa **aplicó** un contrato mirando el campo que sólo aparece si
  lo aplicó (`structured_output`), nunca su código de éxito: `claude -p --json-schema` ignora el
  schema si éste declara `$schema` (`z.toJSONSchema()` la emite) y devuelve `is_error: false`.
  Sondear siempre con el artefacto real que va a viajar, no con uno escrito a mano.

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
