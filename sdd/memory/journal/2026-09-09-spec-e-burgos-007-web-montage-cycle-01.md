# spec-e-burgos-007-web-montage cycle-01 — 2026-09-09

## Qué pasó

**1. Ensanchar una unión discriminada rompe call sites fuera de la lista cerrada del architect.**
Agregar la variante `'empty'` a `JsonBodyResult` (TASK-016) rompió la exhaustividad del `switch`
en `projects-handler.ts`, un archivo que no figuraba en el `files[]` de ninguna task del ciclo y
que el architect §10 declaraba explícitamente fuera de alcance. Lo mismo con `CreateJobInput` al
volverse `CreateRenderJobInput | CreateMontageJobInput`. Hubo que ampliar el `files[]` de TASK-017
(con `projects-handler.ts` + spec) y el de TASK-018 (con `handle-request.ts`, para una sola línea:
pasar `request` como 4to argumento). El architect también se contradecía: §4.1/§4.2 exigían leer el
body en `handleCreateRenderJob` —lo que obliga a pasarle `HttpRequestLine`— mientras §10 declaraba
que `handle-request.ts` no se tocaba.

**2. Vitest no tipa los specs, y eso dispara la rama equivocada de una unión discriminada.**
`jobs-handler.spec.ts` creaba jobs sin el discriminante `kind` de `CreateJobInput`. Los objetos
caían en la rama **montage** de la cola y explotaban con `MONTAGE_RAW_MISSING` o colgaban 5 s —
con `lint` y `build` en verde, porque el error no está en el grafo de tipos que el build compila.
Los dos implementadores propusieron un guard de runtime en `render-job-queue.ts`
(`else if input.kind !== 'montage' throw`); se descartó: con la unión discriminada esa rama es
inalcanzable desde código tipado, y la lección vigente del repo prohíbe guards sobre condiciones
imposibles. La defensa correcta era tipar el fixture, no blindar producción.

**3. Un oráculo "bytes idénticos" tiene que excluir los campos de reloj de pared.**
CA-012 pedía que los tres sha256 (`catalog.json`, `timeline.json`, `edl.json`) fueran idénticos a
los de la corrida de referencia. No es satisfacible por construcción: `catalog.json` y
`timeline.json` llevan `probedAt` (reloj de pared) y `modifiedAtMs` (mtime del archivo), que
cambian en cada corrida. Diff estructural: esos dos campos son la **única** diferencia entre la
corrida del CLI y la de la API. El oráculo byte-exacto real es `edl.json`, idéntico en las tres
corridas independientes y **probado sensible** (cambia con el `seed`), que es lo que lo vuelve un
oráculo y no una tautología.

## Lección

Ensanchar un tipo suma (unión discriminada, enum, result kind) es un cambio **global** que ningún
`files[]` de task acota; un test sin tipos y un oráculo con campos de reloj de pared fallan los dos
en silencio, con el build en verde.

## Costo evitable

Las tres desviaciones se detectaron implementando y se resolvieron dentro del ciclo, pero costaron
iteraciones que un chequeo previo evitaba:

- Antes de ensanchar un tipo suma, correr `tsc`/`nx build` del subproyecto y tratar **todos** los
  errores de exhaustividad como parte del alcance de la task — no confiar en el `files[]` del
  architect, que se escribe antes de conocerlos. Barato: una corrida de build.
- Tipar los fixtures de test contra el tipo de producción (`CreateJobInput`, no un objeto literal
  suelto): el ciclo perdió depuración en jobs que colgaban 5 s por un campo faltante que el
  compilador habría marcado. Nunca compensar esto con un guard de runtime sobre una condición que
  el sistema de tipos ya vuelve imposible.
- Redactar los CA de determinismo excluyendo explícitamente los campos no deterministas
  (`edl.json` byte-idéntico; `catalog`/`timeline` idénticos tras descartar `probedAt` y
  `modifiedAtMs`) y exigiendo que el oráculo se pruebe sensible a una variable de entrada. Un CA
  imposible se paga al final del ciclo, cuando el smoke ya corrió.
