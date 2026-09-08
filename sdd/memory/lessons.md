# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.2 | Última destilación: 2026-09-08 (spec-002 cycle-03, spec-003 cycles 01-02, spec-004 cycles 01-02, FIX-001-001, FIX-002-001)
> **Cap duro: 120 líneas.** Este archivo se lee COMPLETO al inicio de cada sesión de agente —
> cada línea acá cuesta tokens en todas las sesiones futuras. Si al destilar se supera el cap,
> primero podar lecciones obsoletas o absorbidas por constitutions/skills.

Reglas de este archivo (ver sección 🧠 MEMORIA GATE del dual-harness):

- **Solo lecciones destiladas**: una línea por lección, accionable, empezando por el verbo
  o la prohibición. Nada de narrativa ni historia — eso vive en `journal/`.
- **Nunca se edita durante un ciclo/fix**: las lecciones nuevas entran como entradas
  episódicas en `sdd/memory/journal/` y solo la destilación (un solo actor) las funde acá.
- **No duplicar** lo que ya dicen las constitutions, skills o el dual-harness: si una lección
  pertenece a un subproyecto concreto, va a su `constitution.md` en la consolidación de
  contexto; acá van las transversales al repo o al proceso.

## Proceso (cómo trabajan los agentes en este repo)

- Citar la evidencia y las decisiones desde `harness.idea.md` en las specs, no copiarlas.
- Emitir SIEMPRE el registro de máquina antes que el documento narrativo (`tasks.json` antes
  que `planner.md`): si la corrida se corta, el ciclo queda arrancable.
- Cerrar toda edición a mano de un `*.json` de `sdd/` corriendo `pnpm sdd:validate` en el
  acto, no al final del ciclo: un `]` por `}` en `tasks.json` lo descubrió el implementador de
  la task siguiente.
- Escalar al dev con el diff cualquier config protegida por el hook `config-protection`
  (`eslint.config.mjs`, `tsconfig.base.json`): cubre `Write|Edit` pero NO `Bash`, rodearlo
  anula el guardrail. Matchea por **basename**: si bloquea la config de un proyecto nuevo,
  registrarla como alcance descopado explícito con su contenido en `architect.md`.
- Serializar en una task previa la infraestructura compartida (helpers, ports, fixtures
  comunes) antes de despachar implementadores en paralelo, y no usar un umbral de cobertura
  **global** como criterio de done de una task paralela — medir por archivo propio.
- Correr el arquitecto **antes** que el planner en specs con contratos densos: las tasks
  nacen sobre firmas cerradas y no hay realineación de `tasks.json`.
- Cuando un RF describe cómo componer algo que otra lib ya entregó, leer la función real de
  esa lib y derivar el contrato de ahí declarando la divergencia: la letra del RF puede
  especificar un defecto semántico que tipos, lint y cobertura no detectan.
- Leer quién **produce** un dato antes de dar default a un flag que elige entre dos fuentes:
  si el productor siempre lo rellena, el default equivocado desactiva features enteras con la
  suite verde. El test que lo protege corre contra el productor real, no contra un fixture.
- Tratar el `files[]` de una task como checklist de cierre: si el architect pide un test en
  un archivo, ese archivo va en `files[]` o no se escribe y nada se pone en rojo; y la task
  que invalida el `files[]` de otra ya cerrada lo corrige ella, no el cierre del ciclo.
- Verificar cada CA por el **símbolo que invoca su test**, no por el título del `it`: un
  helper anterior de forma parecida hace pasar el criterio sin ejercitar el nuevo.
- Contrastar al cerrar el diff contra la lista de tests obligatorios del architect uno por uno,
  y leer `coverage.include` antes de confiar en un piso: un piso que no incluye los archivos
  del ciclo no es evidencia de nada.
- Nunca copiar un fixture literal de otro ciclo a un documento de arquitectura: se pega el
  estado viejo y contradice las decisiones del propio documento; generarlo desde el código o
  referenciar la sección origen.
- Verificar que un error tipado PUEDE dispararse antes de darlo por implementado: un guard
  sobre una condición imposible es código muerto con nombre de validación.
- Un CA aceptado como "procedimiento documentado, nunca ejecutado" **no está verificado**:
  ejecutarlo una vez al cerrarlo o registrarlo explícitamente como no verificado (el smoke de
  `composition-remotion` estuvo roto dos specs sin que nadie lo supiera).
- Dejar en el README el comando exacto para regrabar una fixture que el entorno no pudo
  capturar, con las diferencias sospechadas contra la salida real del binario.
- Destilar el journal al abrir el ciclo, sin excepción: una lección que vive solo en
  `journal/` no protege a nadie y se vuelve a pagar entera.

## Técnica (stack, herramientas, gotchas transversales)

- Verificar `NX_WORKSPACE_ROOT_PATH` antes de cualquier `nx …`: si apunta a otro repo, Nx
  ejecuta los targets de ESE repo sin error visible.
- No dar por verde un `init` sin correr `nx run-many -t lint test build`: `sdd:validate`
  no compila nada.
- Auditar, en la MISMA task del scaffold de un generador Nx, tres lugares: `package.json`
  (dependencias que nada importa), `nx.json` (plugins inferidos — `@nx/vitest` trae `test` en
  modo **watch** y cuelga `run-many`) y los archivos dejados en `src/` (placeholders,
  `export {};`). Lo que no se poda ahí sobrevive el ciclo entero.
- Ejecutar un `.ts` suelto con `node -r @swc-node/register` (registro CJS) **acotado a
  TypeScript** (patrón `cli-register.cjs`): el hook ESM y `--experimental-strip-types` no
  funcionan en este repo, y el loader de `.js` de swc panica sin nombrar el archivo cuando el
  proceso carga `.js` de terceros (webpack de Remotion, hook de Console Ninja).
- Apuntar `SWC_NODE_PROJECT` a un tsconfig con `baseUrl` en la raíz del workspace en todo
  target `nx:run-commands` con `cwd` de proyecto: no hereda los `paths` de `tsconfig.base.json`.
- Declarar el alias `@video-maker/*` de una lib en los **TRES** resolvedores cuando otra lib
  importa un valor: `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts`
  (Vitest) y `webpackOverride` de `@remotion/bundler` (render). `lint`, `build` y tests verdes
  no prueban que el bundler resuelva.
- Nunca copiar el union de códigos de error de otra lib: derivarlo con `import type` o
  estrechar en la frontera con un type guard sobre una lista propia `as const`. Al mergear ramas
  de specs distintas, `nx run-many -t build` **antes** de commitear: los conflictos semánticos
  no aparecen en `git status`.
- Verificar un exit code exacto invocando el **binario**, nunca vía `nx run`: Nx normaliza
  todo fallo a `1`.
- Comparar la duración de un render contra el **stream de video** (`nb_frames`/`r_frame_rate`),
  nunca contra `format.duration` (máximo entre streams, inflado por el padding AAC);
  `pix_fmt=yuvj420p` es rótulo de rango de color, no otro submuestreo.
- Largar un render o transcripción solo sin procesos `ffmpeg`/`whisper-cli`/`chrome-headless`
  vivos y con ≥ 35 % de memoria libre; nunca esperar `memory_pressure` en `normal` (nivel
  basal 2 en esta máquina) ni correr render y transcripción a la vez.
- Post-procesar `z.toJSONSchema(registry)` inlineando los `$ref` al documento sintético
  `__shared` que Zod inventa cuando dos schemas reusan una subestructura.
- Declarar como `type` (nunca `interface`) los props de componentes de librerías genéricas y
  **omitir** las claves opcionales en vez de asignar `undefined` (`exactOptionalPropertyTypes`).
- Cargar un binario o paquete nativo con `await import()` dentro del método que lo usa, no en
  el tope del módulo.
- Verificar con un test el orden de claves de `JSON.stringify` tras un `.parse()` de Zod
  cuando un CA depende de bytes idénticos (no es el orden del literal), e inyectar un `Clock`
  fijo en la **ingesta** en todo test que compare bytes entre dos corridas del pipeline.
- Elegir al menos un valor distinto de cero por eje posicional en las fixtures (`from`,
  `trimStartMs`): `f(0)` da 100 % de cobertura sin distinguir la fórmula correcta de casi
  ninguna incorrecta.
- Mirar la cardinalidad del espacio de salida antes de elegir el par de seeds de un test de
  sensibilidad: con pocos valores posibles dos seeds colisionan y dan falso rojo.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Registrar el consumo por unidad de trabajo al cerrarla (task, documento, fix): sin eso el
  total del ciclo se reconstruye de memoria al final.
- Capturar `subagent_tokens` de la notificación de cada subagente en el momento: es la única
  medición exacta gratuita y no se recupera después.
- Reanudar al mismo implementador con `SendMessage` task tras task en vez de relanzar uno
  nuevo (~45 k vs ~120 k tokens por task), y computar el `usage` de cada task como el
  **delta** contra la notificación anterior: `subagent_tokens` viene acumulado por sesión.
- Diagnosticar primero la herramienta de medición cuando "esto debería andar y no anda" sobre
  código con tests verdes (`nx run` y `format.duration` costaron una bisección cada uno).
