# spec-e-burgos-005-render-service cycle-01 — 2026-09-08

## 1. La lista cerrada de tests tenía el invariante central afuera

### Qué pasó

CA-003 exige que el paso de render reciba `audio: 'muted'` — el invariante que separa un entregable
correcto de uno con el audio de Remotion encima de la mezcla masterizada. La lista cerrada de tests
del `architect.md` §9.1 (31 filas, contrastadas fila por fila y todas presentes) cubría el **orden**
de las cuatro llamadas, el `publicDir` y el encadenado del mux, pero ninguna fila aseveraba el
literal `audio: 'muted'`: ese literal sólo existe en `node-render-api-dependencies.ts`, el adaptador
de producción, cuya task (TASK-013) tenía un `files[]` sin spec hermano. Con las 15 tasks en verde y
las 31 filas de §9.1 presentes, el invariante central del ciclo no lo probaba nada. El orquestador lo
detectó al revisar TASK-013 y agregó `node-render-api-dependencies.spec.ts` al `files[]`, con
`toHaveBeenCalledWith` estricto sobre el objeto de opciones completo. Es reincidencia del gap de
CA-011 de spec-004, en una forma nueva: acá no falló el `files[]` frente al architect, falló la lista
cerrada del architect frente al CA.

### Lección

Trazar cada CA al archivo que **emite** el valor que el CA nombra, no al que nombra la operación: si
un CA cita un literal, el spec hermano del archivo donde ese literal está escrito es obligatorio en la
lista cerrada y en el `files[]`.

### Costo evitable

Una task de 3 story points reabierta a mitad de ciclo (~40K tokens de re-lectura y re-escritura), y el
riesgo real de cerrar el ciclo con el invariante que justifica el pipeline entero sin una sola aserción.

## 2. El `depends_on` del planner se dedujo del agrupamiento por historia, no de los imports

### Qué pasó

El `planner.md` declaró TASK-003 (configuración por entorno, HU-1-02) dependiente sólo de TASK-001,
porque agrupó por historia. Pero `server-config.ts` lanza `PipelineStageError`, que nace en TASK-004
(HU-1-06): `apps/render-api/src/config/server-config.ts:1` importa `../errors/pipeline-stage-error`.
El implementador lo descubrió recién al ir a escribir el archivo; el orquestador agregó la arista
`TASK-003 → TASK-004` a `tasks.json` en vuelo.

### Lección

Derivar `depends_on` de los imports que el architect ya escribió en las firmas, no del agrupamiento
por historia de usuario: dos tasks de historias distintas se acoplan por un símbolo compartido.

### Costo evitable

Un arranque de subagente en falso y una corrección de grafo con el ciclo abierto — barato acá, caro
en un ciclo con fan-out paralelo, donde la arista faltante habría dejado la task corriendo contra un
símbolo inexistente.

## 3. Un `tokens_in`/`tokens_out` tipeado a mano rompe la suma y el validador no lo ve

### Qué pasó

Al cerrar, la suma de `by_agent` no daba el total de las 15 tasks. El desvío exacto (47.286) venía de
una sola entrada: TASK-006 tenía `tokens_in: 68000` / `tokens_out: 9500` — dos números redondos
tipeados a mano — contra un `tokens_total: 30214` medido. El resto de las tasks respeta el split
documentado 85/15 de `tokens_total` (verificable: 100158 → 85134/15024). `pnpm sdd:validate` pasó en
verde con la entrada rota: no cruza `tokens_in + tokens_out` contra `tokens_total`.

### Lección

Al registrar `usage` con `source: agent-usage-notification`, derivar `tokens_in`/`tokens_out` del
split 85/15 de `tokens_total` en vez de tipearlos; el validador no cruza esos tres campos, así que el
único control es aritmético y lo hace quien cierra.

### Costo evitable

Un ciclo cerrado con el dashboard de Costos inflado 10 % sobre el consumo real, sin ninguna compuerta
que lo marque — y la evidencia de ahorro del método apoyada en un número que no cierra consigo mismo.
