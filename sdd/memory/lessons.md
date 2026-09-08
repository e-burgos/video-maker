# 🧠 Memoria del proyecto — lecciones destiladas

> Versión 1.1 | Última destilación: 2026-09-07 (spec-001 cycles 01-03, spec-002 cycles 01-02)
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

- Citar la evidencia y las decisiones desde `harness.idea.md` en las specs en vez de
  copiarlas a mano.
- Emitir SIEMPRE el registro de máquina antes que el documento narrativo (`tasks.json` antes
  que `planner.md`): si la corrida se corta, el ciclo queda arrancable en vez de parecer
  planificado sin poder ejecutar nada.
- Escalar al dev con el diff cualquier cambio en una config raíz protegida por hook
  (`eslint.config.mjs`, `tsconfig.base.json`): el matcher cubre `Write|Edit` pero NO `Bash`,
  así que rodearlo pasa silencioso y deja de ser un guardrail.
- Serializar en una task previa la infraestructura compartida (helpers, ports, fixtures
  comunes) antes de despachar implementadores en paralelo, y no usar un umbral de cobertura
  **global** como criterio de done de una task paralela — medir por archivo propio.
- Corregir el `files[]` de una task ya cerrada cuando otra task la invalida: es parte del
  trabajo de la task que borra, no del cierre del ciclo.
- Verificar que un error tipado PUEDE dispararse antes de darlo por implementado: un guard
  sobre una condición imposible es código muerto con nombre de validación.
- Dejar en el README el comando exacto para regrabar una fixture que el entorno no pudo
  capturar, y anotar las diferencias sospechadas contra la salida real del binario.
- Destilar el journal al abrir el ciclo, sin excepción: una lección que vive solo en
  `journal/` no protege a nadie y se vuelve a pagar entera (pasó con el orden de claves de
  Zod, descubierto en un ciclo y re-descubierto en el siguiente).

## Técnica (stack, herramientas, gotchas transversales)

- Verificar `NX_WORKSPACE_ROOT_PATH` antes de cualquier `nx …`: si apunta a otro repo,
  Nx ejecuta los targets de ESE repo sin error visible (pasó en Claude Code con otro
  directorio primario).
- No dar por verde un `init` sin correr `nx run-many -t lint test build`: `sdd:validate`
  no compila nada.
- Auditar, en la MISMA task del scaffold de un generador Nx, tres lugares: `package.json`
  (dependencias que nada importa), `nx.json` (plugins inferidos — `@nx/vitest` trae `test` en
  modo **watch** y cuelga `run-many`) y los archivos dejados en `src/` (placeholders,
  `export {};`). Lo que no se poda ahí sobrevive el ciclo entero.
- Ejecutar un `.ts` suelto con `node -r @swc-node/register` (registro CJS): el hook ESM
  `@swc-node/register/esm-register` y `--experimental-strip-types` no funcionan en este repo.
- Declarar el alias de una lib en los DOS lados cuando otra lib importa un **valor** (no solo
  tipos): `tsconfig.base.json → paths` para `tsc` y `resolve.alias` del `vite.config.ts` para
  Vitest. `lint` y `build` verdes no prueban que la suite resuelva los imports.
- Post-procesar la salida de `z.toJSONSchema(registry)` inlineando los `$ref` al documento
  sintético `__shared` que Zod inventa cuando dos schemas reusan una subestructura.
- Declarar como `type` (nunca `interface`) los props de componentes de librerías genéricas y
  **omitir** las claves opcionales en vez de asignarles `undefined`: lo exige
  `exactOptionalPropertyTypes: true`.
- Cargar un binario o paquete nativo con `await import()` dentro del método que lo usa, no en
  el tope del módulo: el aislamiento de CI pasa a ser estructural y no depende de que cada
  test recuerde inyectar un doble.
- Verificar con un test el orden de claves de `JSON.stringify` tras un `.parse()` de Zod
  cuando un criterio de aceptación depende de bytes idénticos: no es el orden del literal.
- Inyectar un `Clock` fijo en la etapa de **ingesta** en todo test que compare bytes entre dos
  corridas completas del pipeline: el no-determinismo entra aguas arriba de lo que estás
  probando.
- Mirar la cardinalidad del espacio de salida antes de elegir el par de seeds de un test de
  sensibilidad: con pocos valores posibles, dos seeds distintas colisionan y dan falso rojo.

## Costo (qué gastó tokens/tiempo de más y cómo evitarlo)

- Registrar el consumo por unidad de trabajo al cerrarla (task, documento, fix): sin
  registro por agente el total del ciclo se reconstruye de memoria al final y el
  dashboard de Costos miente.
- Capturar `subagent_tokens` de la notificación de cada subagente (Claude Code) en el
  momento: es la única medición exacta gratuita y no se recupera después.
- Reanudar al mismo implementador con `SendMessage` task tras task en vez de relanzar uno
  nuevo (~45 k vs ~120 k tokens por task), y computar el `usage` de cada task como el
  **delta** contra la notificación anterior: `subagent_tokens` viene acumulado por sesión.
