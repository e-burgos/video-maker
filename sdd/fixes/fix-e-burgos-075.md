# FIX-e-burgos-075 — El riser llega al drop con su cresta

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-075 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El compose del modo B (FIX-e-burgos-062) arrancaba el riser una duración del archivo antes del drop: lo alineaba por el final del archivo. Pero la cresta no siempre está al final. En la verificación del studio, riser-2 tenía la cresta 0,7 s antes del final, así que la subida se sentía adelantada.

## Solución
- El riser arranca `peakMs` antes del drop. `peakMs` es el campo que la sesión de música agregó al banco en el FIX-e-burgos-074.
- De paso se corrige `impact-sfx.spec.ts`, que seguía pasándole a `impactTrack` el argumento que se sacó en el FIX-e-burgos-062 (error de tipos en el typecheck de los specs).

## Verificación
- `nx test`, `lint` y `build` en verde para motion-graphics (345). `impact-sfx.spec.ts` ya no aparece en el typecheck de los specs.
- Medición con el banco real y el código de compose (drop en 10 s):

| Riser | Cresta antes | Cresta ahora |
| --- | --- | --- |
| riser-1 | 60 ms antes del drop | en el drop |
| riser-2 | 1010 ms antes del drop | en el drop |
| riser-3 | 180 ms antes del drop | en el drop |
