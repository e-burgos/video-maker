# TASK-004 — Desvíos respecto a las instrucciones de despacho

> El contrato vinculante es `architect.md` (D-10, D-15, §4.2, §5.2, §6.4, CA-018). Donde el mensaje
> de despacho pedía algo distinto de lo que `architect.md` fija como normativo, se siguió
> `architect.md`.

## 1. Fixture sin banner/progreso de ffmpeg

El despacho pedía una fixture "con el banner de ffmpeg, líneas de progreso y las líneas
`silencedetect`". `architect.md` §4 es explícito: los comandos de `ffmpeg` de esta lib anteponen
`-hide_banner -nostats` **para que el stderr real nunca traiga banner ni líneas de progreso**; y
§6.4 fija la fixture normativa como únicamente las 5 líneas de `silencedetect` sobre el clip de
10000 ms. Agregar banner/progreso habría producido una fixture que no es "salida real" del comando
que este wrapper ejecuta (D-15). Se usó la fixture exacta de §6.4.

## 2. Sin caso "línea corrupta → UnparseableOutputError"

El despacho pedía ese caso. `architect.md` §5.2 fija el algoritmo de `parseSilenceDetect` como un
scanner línea a línea por regex (`START`/`END`) que **ignora sin error** cualquier línea que no
matchee, y aclara explícitamente que un `stderr` sin ninguna línea de `silencedetect` es `[]`
válido, "no un `UnparseableOutputError`: no hay forma de distinguirlo de un clip íntegramente
hablado". No existe en el contrato una noción de "línea corrupta" para este parser (a diferencia de
`parseFfprobeJson`/`parseLoudnormJson`, que sí parsean JSON y sí pueden fallar). No se implementó
ese comportamiento por no estar en el contrato; se cubrieron en cambio los 6 casos de la tabla
CA-018 más 3 casos de borde ya documentados en D-13/§5.2 (rango degenerado, dos `silence_start`
seguidos, redondeo de fracciones de segundo).

## 3. Sin `src/__fixtures__/load-fixture.ts` compartido

D-15 documenta un helper compartido `readFixture()` en `src/__fixtures__/load-fixture.ts`. Las
reglas de convivencia del despacho restringen esta task a `src/ffmpeg/**` y
`src/__fixtures__/ffmpeg/**`; crear ese archivo compartido es zona común con TASK-003 (ffprobe, en
paralelo) y arriesgaba colisión. `silencedetect.spec.ts` lee la fixture inline con
`readFileSync(new URL(...), 'utf8')` (permitido: `no-restricted-imports` de `node:fs` no aplica a
`src/**/*.spec.ts`, ver `eslint.config.mjs`). Queda pendiente que quien cierre el ciclo (TASK-008 o
el Reviewer) centralice esto en `load-fixture.ts` si TASK-003 no lo hizo ya, y migre este spec a
usarlo.

## 4. Cobertura global por debajo de 80% al momento de cerrar esta task

Con `src/ffprobe/**` (TASK-003) en progreso en paralelo, `pnpm nx test media-local` reporta
branches globales en 79.03% (< 80%). El déficit es enteramente ajeno a esta task:
`src/ffprobe/parse-ffprobe-json.ts` (71.26% branches, en progreso), `src/runner/execa-command-runner.ts`
(40% branches, de TASK-002) y `src/clock.ts` (0% funciones, de TASK-002/no consumido aún por ningún
wrapper). Los archivos de esta task (`src/ffmpeg/parse-silence-detect.ts`,
`src/ffmpeg/detect-silences.ts`) miden **100%** en statements/branches/functions/lines de forma
aislada. No se tocó ningún archivo fuera de `src/ffmpeg/**` y `src/__fixtures__/ffmpeg/**` para
"arreglar" este número, conforme a la regla de convivencia (d) del despacho.
