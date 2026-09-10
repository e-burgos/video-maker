# spec-e-burgos-015-studio-producer cycle-02 — 2026-09-10

## Qué pasó

El E2E del productor cuesta dos turnos reales de `claude -p` (varios minutos y cuota de la
suscripción), así que antes de la primera corrida completa se puso un gate barato en el guion
(`PRODUCER_SMOKE_STOP_AFTER=4`) que ejecuta copia del proyecto, los dos servidores, la navegación
y las aserciones del inventario **sin gastar un token**. El sondeo pasó limpio en 40 segundos.

La primera corrida real murió igual, ~90 segundos después de arrancar el turno 1, con
`startTurn is not defined`. La causa: una edición scriptada con `str.replace()` sobre el `.mjs`
tenía **dos** reemplazos, uno para los call sites y otro para la definición de la función; el de la
definición no matcheó (el patrón traía un `\s+` que en el archivo estaba escrito distinto) y
`str.replace` no avisa cuando no encuentra nada. `node --check` pasó —un identificador inexistente
es un `ReferenceError` de runtime, no un error de sintaxis—, `eslint` pasó, y la única señal fue el
turno pagado que ya estaba corriendo. Se arregló localizando el bloque por línea (`startswith`) en
vez de por patrón, y verificando con `grep -n "^async function"` que la definición existiera.

El gate barato tampoco lo habría atrapado: estaba **antes** del código que falló. Un probe sólo
verifica lo que corre de su lado del `return`.

## Lección

Después de toda edición scriptada por patrón, verificar que el símbolo editado EXISTE (grep de la
definición), no que el archivo parsea: un `replace` que no matchea es silencioso y `node --check`
no ve un identificador faltante.

## Costo evitable

Un turno real de `claude -p` (~90 s de agente y su cuota) más una corrida de servidores, por un
reemplazo silencioso. El grep de verificación cuesta una llamada.
