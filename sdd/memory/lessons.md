# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.3 | Última destilación: 2026-09-09 (spec-005 cycles 01-03, spec-006 cycles 01-02)
> **Cap duro: 120 líneas.** Este archivo se lee COMPLETO al inicio de cada sesión de agente —
> cada línea acá cuesta tokens en todas las sesiones futuras. Si al destilar se supera el cap,
> primero podar lo obsoleto o ya absorbido por constitutions/skills.

Reglas (detalle en la sección 🧠 MEMORIA GATE del dual-harness): una lección por línea,
accionable, empezando por el verbo o la prohibición — la narrativa vive en `journal/` y acá no se
edita nada durante un ciclo/fix. Lo propio de un subproyecto va a su `constitution.md`; acá, sólo
lo transversal al repo o al proceso, y nunca lo que ya dicen constitutions, skills o el harness.

## Proceso (cómo trabajan los agentes en este repo)

- Emitir SIEMPRE el registro de máquina antes que el documento narrativo (`tasks.json` antes
  que `planner.md`): si la corrida se corta, el ciclo queda arrancable.
- Cerrar toda edición a mano de un `*.json` de `sdd/` corriendo `pnpm sdd:validate` en el acto:
  un `]` por `}` en `tasks.json` lo descubrió el implementador de la task siguiente.
- Escalar al dev con el diff cualquier config protegida por el hook `config-protection`
  (`eslint.config.mjs`, `tsconfig.base.json`): cubre `Write|Edit` pero NO `Bash`, rodearlo anula
  el guardrail; matchea por **basename**, y lo bloqueado se descopa por escrito en `architect.md`.
- Serializar en una task previa la infraestructura compartida (helpers, ports, fixtures) antes de
  despachar implementadores en paralelo, y medir el done de una task paralela por cobertura de
  archivo propio, nunca con un piso **global**.
- Correr el arquitecto **antes** que el planner en specs con contratos densos, y derivar el
  `depends_on` de cada task de los **imports que el architect ya escribió en las firmas**, no del
  agrupamiento por historia: dos historias distintas se acoplan por un símbolo compartido.
- Cuando un RF describe cómo componer algo que otra lib ya entregó, derivar el contrato de la
  función real declarando la divergencia: la letra del RF puede especificar un defecto semántico
  que tipos, lint y cobertura no detectan.
- Leer quién **produce** un dato antes de dar default a un flag que elige entre dos fuentes: si
  el productor siempre lo rellena, el default equivocado desactiva features enteras con la suite
  verde. El test que lo protege corre contra el productor real, no contra un fixture.
- Tratar el `files[]` como checklist de cierre y trazar cada CA al archivo que **emite** el valor
  que nombra, no al que nombra la operación: si un CA cita un literal, el spec hermano de ese
  archivo es obligatorio en la lista cerrada del architect y en el `files[]`.
- Verificar cada CA por el **símbolo que invoca su test**, no por el título del `it`: un helper
  anterior de forma parecida hace pasar el criterio sin ejercitar el nuevo.
- Contrastar al cerrar el diff contra la lista de tests obligatorios del architect uno por uno,
  y leer `coverage.include` antes de confiar en un piso: un piso que no incluye los archivos
  del ciclo no es evidencia de nada.
- Aserar todo payload nuevo con `Object.keys(body).sort()` contra la interfaz del `architect.md`,
  nunca campo por campo contra lo que el handler ya emite: eso último no verifica ningún contrato
  (dos endpoints devolvieron dos formas de la misma entidad con 215 tests en verde).
- Verificar que un error tipado PUEDE dispararse antes de darlo por implementado: un guard sobre
  una condición imposible es código muerto con nombre de validación.
- Un CA aceptado como "procedimiento documentado, nunca ejecutado" **no está verificado**: correr
  el guion de ejecución real en la **primera** task que deja el binario arrancable, no al cerrar
  (el smoke de `composition-remotion` estuvo roto dos specs sin que nadie lo supiera).
- Cuando el invariante del ciclo es "la salida binaria no cambia", usar el `sha256` del artefacto
  como oráculo **y probar que el oráculo es sensible** corriendo a propósito el cambio que
  debería romperlo: muestrear píxeles, `nb_frames` o mirar la captura dan verde ante cambios reales.
- Destilar el journal al abrir el ciclo, sin excepción: una lección que vive solo en `journal/`
  no protege a nadie y se vuelve a pagar entera.

## Técnica (stack, herramientas, gotchas transversales)

- Verificar `NX_WORKSPACE_ROOT_PATH` antes de cualquier `nx …`: si apunta a otro repo, Nx
  ejecuta los targets de ESE repo sin error visible.
- No dar por verde un `init` sin correr `nx run-many -t lint test build`: `sdd:validate` no
  compila nada y Vitest no tipa (un `const facts = [media.kind]` rompió `build` con `test` verde).
- Auditar, en la MISMA task del scaffold de un generador Nx, tres lugares: `package.json`
  (deps que nada importa), `nx.json` (plugins inferidos — `@nx/vitest` trae `test` en modo
  **watch** y cuelga `run-many`) y los placeholders de `src/`; lo que no se poda ahí sobrevive.
- Ejecutar un `.ts` suelto con `node -r @swc-node/register` (registro CJS) **acotado a
  TypeScript** (patrón `cli-register.cjs`): el hook ESM y `--experimental-strip-types` no andan acá,
  y el loader `.js` de swc panica sin nombrar el archivo si el proceso carga `.js` de terceros.
- Exportar `SWC_NODE_PROJECT=tsconfig.base.json` (con `baseUrl` en la raíz) en todo target
  `nx:run-commands` con `cwd` de proyecto **y también al invocar el binario a mano**: sin él el
  proceso ni arranca, y ni `lint`, ni `build`, ni la suite ven ese fallo.
- Declarar el alias `@video-maker/*` de una lib en los **TRES** resolvedores cuando otra lib
  importa un valor: `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts`
  (Vitest) y `webpackOverride` de `@remotion/bundler` (render) — verde en los tres targets no
  prueba que el bundler resuelva.
- Nunca copiar el union de códigos de error de otra lib: derivarlo con `import type` o estrechar
  en la frontera con un type guard sobre una lista propia `as const`. Al mergear ramas de specs
  distintas, `nx run-many -t build` **antes** de commitear: el conflicto semántico no está en `git status`.
- Pasar la raíz junto al documento en todo puerto cuyo input lleve paths **relativos**
  (`projectRoot` + `runOptions.cwd`): el doble del puerto no los resuelve y ninguna suite lo ve
  — sólo el primer binario real, después de 538 frames renderizados.
- Verificar un exit code exacto invocando el **binario**, nunca vía `nx run` (Nx normaliza todo
  fallo a `1`), y sabiendo que `@remotion/renderer` instala sus propios handlers de señal: tras
  un render, `SIGTERM` da `143` aunque el server cierre limpio, y `process.exit(0)` no lo cambia.
- Comparar la duración de un render contra el **stream de video** (`nb_frames`/`r_frame_rate`),
  nunca contra `format.duration` (máximo entre streams, inflado por el padding AAC);
  `pix_fmt=yuvj420p` es rótulo de rango de color, no otro submuestreo.
- Largar un render o transcripción solo sin procesos `ffmpeg`/`whisper-cli`/`chrome-headless`
  vivos y con ≥ 35 % de memoria libre; nunca esperar `memory_pressure` en `normal` (nivel
  basal 2 en esta máquina) ni correr render y transcripción a la vez.
- Verificar una UI midiendo en el navegador el estado del medio (`readyState` 4, `duration`,
  `videoWidth/Height`), nunca la captura ni el `src`: un `src` bien armado y un 404 se ven igual.
  El MCP de Playwright de este arnés no abre navegador (le falta su extensión); anda el Playwright
  cacheado en `~/.npm/_npx` con `chromium.launch({ channel: 'chrome' })` — comprobarlo al ABRIR.
- Declarar como `type` (nunca `interface`) los props de componentes de librerías genéricas y
  **omitir** las claves opcionales en vez de asignar `undefined` (`exactOptionalPropertyTypes`).
- Cargar un binario o paquete nativo con `await import()` dentro del método que lo usa, no en el
  tope del módulo — y nunca mezclar `import` estático y `await import()` de la misma lib del
  workspace: `@nx/enforce-module-boundaries` lo prohíbe; el consumidor perezoso se mueve a un
  módulo que sólo alcanza la ruta perezosa.
- Verificar con un test el orden de claves de `JSON.stringify` tras un `.parse()` de Zod cuando
  un CA depende de bytes idénticos (no es el orden del literal), e inyectar un `Clock` fijo en la
  **ingesta** en todo test que compare bytes entre dos corridas del pipeline.
- Elegir al menos un valor distinto de cero por eje posicional en las fixtures (`from`,
  `trimStartMs`): `f(0)` da 100 % de cobertura sin distinguir la fórmula correcta de casi
  ninguna incorrecta.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Registrar el consumo por unidad de trabajo al cerrarla (task, documento, fix): sin eso el total
  del ciclo se reconstruye de memoria al final.
- Capturar `subagent_tokens` de la notificación de cada subagente en el momento: es la única
  medición exacta gratuita y no se recupera después.
- Reanudar al mismo implementador con `SendMessage` task tras task en vez de relanzar uno nuevo
  (~45 k vs ~120 k por task), computar el `usage` de cada task como el **delta** contra la
  notificación anterior (`subagent_tokens` viene acumulado) y derivar `tokens_in`/`tokens_out` del
  split 85/15 de `tokens_total`: el validador no cruza esos tres campos, el control es aritmético.
- Diagnosticar primero la herramienta de medición cuando "esto debería andar y no anda" sobre
  código con tests verdes (`nx run` y `format.duration` costaron una bisección cada uno), y ante
  "por qué se ve distinto" medir los dos lados antes de leer el código de la librería.
