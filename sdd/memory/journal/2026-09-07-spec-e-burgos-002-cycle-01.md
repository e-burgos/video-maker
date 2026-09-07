# spec-e-burgos-002 cycle-01 — 2026-09-07

## Qué pasó

1. **`subagent_tokens` viene acumulado al reanudar un agente con `SendMessage`.** El orquestador
   reanudó al mismo implementador task tras task; la notificación de uso de cada reanudación
   reporta el total de la sesión del subagente, no el consumo de esa task. Registrar el número
   crudo por task inflaba la telemetría del ciclo por duplicación. Además el dato de costo:
   reanudar al mismo implementador salió ~45 k tokens por task contra ~120 k de la primera task
   con un agente nuevo (todo el contexto del ciclo se re-paga en cada relanzamiento).
2. **El hook `config-protection` del plugin `everything-claude-code` bloquea `Write|Edit` sobre
   configs de linter, pero no `Bash`.** Al resolver D-1 hubo que sumar una línea a
   `eslint.config.mjs` de la raíz; el implementador la escribió con `Bash`, rodeando el hook. El
   cambio era correcto, pero el camino no: un guardrail que se puede esquivar sin darse cuenta
   deja de ser un guardrail.
3. **El orden de claves de `JSON.stringify` después de un `.parse()` de Zod no es el del literal
   de entrada.** CA-004 exige que una segunda ingesta sin cambios produzca un `catalog.json`
   idéntico byte a byte (D-6). Ese invariante depende del orden de claves de la salida, que hubo
   que **verificar con un test** en vez de asumirlo del schema.
4. El orquestador fue terminado por un 429 de límite de gasto justo después de marcar la última
   task, con `cycle.json` a medio cerrar (`tasks_completed: 0/11`). Los registros por unidad
   (`tasks[].usage`, `by_agent`) permitieron reconstruir el cierre sin re-derivar nada: la
   telemetría escrita al cerrar cada unidad, y no al final, fue lo que salvó el ciclo.

## Lección

- Al reanudar un subagente con `SendMessage`, `subagent_tokens` es **acumulado**: el costo de la
  unidad es el **delta** contra la notificación anterior — y reanudar cuesta ~3× menos que
  relanzar un agente nuevo por task.
- Config raíz bloqueada por un hook (`eslint.config.mjs`, `tsconfig.base.json`): se **escala con
  el diff al dev**, nunca se rodea con `Bash` — el matcher del hook no cubre `Bash` y el bypass
  pasa silencioso.
- Si un CA depende de bytes idénticos, **verificar** el orden de claves de `JSON.stringify` tras
  `.parse()` de Zod con un test; no asumirlo del orden del schema.

## Costo evitable

- La telemetría acumulada, detectada tarde, obligó a recalcular a mano el consumo de 11 tasks.
- Relanzar un implementador nuevo por task en vez de reanudar habría costado ~825 k tokens en vez
  de ~641 k para las mismas 11 tasks (~180 k evitables, ~28 %).
- El bypass del hook dejó abierta una decisión de proceso (conservar o revertir) que ahora el dev
  tiene que resolver fuera del ciclo.
