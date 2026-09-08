# spec-e-burgos-004 cycle-02 — 2026-09-08

## Qué pasó

**1. Un `files[]` incompleto en una task borró tests obligatorios, en silencio.** El `architect.md`
§9.4 enumeraba **cuatro** tests para CA-011; dos vivían en `render.spec.ts`. El `files[]` de
TASK-008 no listaba ese archivo, el implementador no lo tocó, y **nada se puso en rojo**: la suite
quedó verde, la cobertura en su piso exacto y la task se cerró `done`. El reviewer lo encontró
recién al contrastar §9.4 contra el diff, uno por uno.

La razón de que nada lo detectara es la segunda mitad del hallazgo:
`libs/composition-remotion/vite.config.ts` declara
`coverage.include: ['src/helpers/**/*.ts', 'src/transitions/**/*.ts']`. **`src/render.ts` está
fuera del scope de cobertura**, así que la rama `audio === 'muted'` no tenía test *ni* threshold que
la vigilara. Los pisos de RNF-2 se cumplían por construcción: no medían ninguno de los archivos que
el ciclo cambió.

**2. El `architect.md` §4.3 arrastró un fixture literal de otro ciclo.** La sección copió el
`-filter_complex` de `cycle-01` §9.3 —que es el grafo de **primera** pasada, sin `measured_*` ni
`linear=true`— mientras D-12/D-13 del mismo documento exigen que el grafo **ejecutado** sea el de
**segunda**. Peor: dos párrafos después el documento exige que "el prefijo de 855 caracteres quede
byte-idéntico" a ese literal. Las dos cosas no pueden ser ciertas. El implementador hizo lo
correcto (segunda pasada) y el documento quedó mintiendo.

**3. Correr el arquitecto ANTES que el planner evitó la realineación de `cycle-01`.** En `cycle-01`
planner y arquitecto corrieron en paralelo y hubo que realinear `tasks.json` entero cuando el
arquitecto cambió firmas. Acá el planner partió de un `architect.md` ya cerrado y las 10 tasks
cerraron sin una sola realineación de alcance.

## Lección

- Si el architect enumera tests obligatorios por CA, **verificar el diff contra esa lista una por
  una** al cerrar: una suite verde con cobertura en el piso no prueba que se escribieron. Y antes
  de confiar en un piso de cobertura, **leer `coverage.include`** — un piso que no incluye los
  archivos del ciclo no es evidencia de nada.
- El `files[]` de una task es una **checklist de cierre**, no una sugerencia: si el architect pide
  un test en un archivo, ese archivo va en `files[]` o el test no se escribe.
- **Nunca copiar un fixture literal de otro ciclo a un documento de arquitectura.** Se pega el
  estado del ciclo viejo y queda contradiciendo a las decisiones del propio documento. Generarlo
  desde el código, o referenciar la sección origen sin transcribirla.
- Con el arquitecto **antes** del planner, las tasks nacen sobre firmas cerradas y no hay
  realineación. En specs con contratos densos, vale la serialización.

## Costo evitable

- El gap de CA-011 costó **una pasada completa de review + reapertura de TASK-008** (~193 K tokens
  de la task reabierta, más la segunda pasada del reviewer y las cinco verificaciones corridas dos
  veces). Un chequeo de `files[]` contra §9.4 al planificar la task lo evitaba entero.
- La errata de §4.3 no costó retrabajo **de casualidad**: el implementador desconfió del literal y
  compuso los esperados llamando a las funciones reales. Si le hubiera creído al documento, habría
  fijado por test el grafo de primera pasada y el entregable habría salido sin normalizar la voz —
  con la suite en verde.
