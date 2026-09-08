# spec-e-burgos-002 cycle-02 — 2026-09-07

## Qué pasó

1. **Dos tests de determinismo dieron rojo en el primer intento por el reloj, no por el código.**
   `timeline.json` salía distinto entre corridas porque `catalog.json` traía un `probedAt` distinto:
   el test no le inyectaba un `Clock` fijo a `ingestProject`. `autoMontage` nunca toca el reloj —
   el falso rojo venía de la etapa de ingesta, aguas arriba. Ningún test de cycle-01 lo había
   necesitado porque ninguno comparaba strings completos entre dos ingestas frescas e
   independientes.
2. **El primer par de seeds elegido para "cambiar el seed cambia la salida" no cambiaba nada.**
   `42` y `4200` caían en la misma escala de punch-in: `pickScale` tiene solo 2 valores en
   `software-demo`, o sea 50 % de probabilidad de colisión.
3. **D-18 mordió igual, con su lección ya escrita en el journal de cycle-01.** Los tests de los
   writers comparaban contra `JSON.stringify(fixture)` crudo y fallaron: el orden de claves del
   objeto persistido es el del schema tras `.parse()`, no el del literal. La lección existía desde
   cycle-01 pero seguía sin destilarse a `lessons.md`, que es lo único que se lee al abrir sesión.
4. **TASK-006 tuvo que borrar los archivos entregados por TASK-005.** El orden estricto de chequeos
   del barrido hacía que reutilizarlos dejara dos implementaciones divergentes de `repeat-window`,
   una sobre el `endMs` crudo en vez del clampeado. El `files[]` de TASK-005 quedó apuntando a rutas
   borradas hasta que el orquestador lo corrigió.
5. **El check de `empty-aroll` que pedía el architect era inalcanzable.** Estaba especificado como
   "cero keeps devueltos por `pruneSilences`", condición matemáticamente imposible porque
   `absorbShortKeepsIntoCuts` rehúsa absorber el último keep. Se movió a antes de podar, sobre
   `arollAsset.durationMs <= frameMs`.

## Lección

1. Cualquier test que compare bytes entre dos corridas COMPLETAS del pipeline tiene que inyectar
   `Clock` fijo en la ingesta: el no-determinismo entra por la etapa de aguas arriba, no por la que
   estás probando.
2. Un test de sensibilidad al seed puede dar falso rojo por el tamaño del espacio de salida: antes
   de elegir el par de seeds, mirá cuántos valores distintos puede producir la función sembrada.
3. Una lección que vive solo en `journal/` no protege a nadie: hasta que no se destila a
   `lessons.md` se vuelve a pagar entera. La destilación al abrir ciclo no es higiene, es el
   mecanismo.
4. Una task puede invalidar el entregable de otra ya cerrada; cuando pasa, corregir el `files[]` de
   la task víctima es parte del trabajo, no del cierre.
5. Verificar que un error tipado PUEDE dispararse es parte de implementarlo: un guard sobre una
   condición imposible es código muerto con nombre de validación.

## Costo evitable

Puntos 1 y 2: dos ciclos de depuración sobre tests que no tenían ningún bug detrás — se buscó la
causa dentro de `autoMontage`, que era el único lugar donde no estaba. Punto 3: la lección estaba
escrita hacía un ciclo y se volvió a pagar completa (reescritura de los tests de los dos writers)
solo porque nadie la había destilado. Punto 4: TASK-005 se implementó, se cerró y se tiró — el
costo entero de una task de 5 story points, evitable si el orden de chequeos del barrido hubiera
estado fijado antes de partirlo en dos tasks.
