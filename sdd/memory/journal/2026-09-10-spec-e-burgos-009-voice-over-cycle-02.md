# spec-e-burgos-009-voice-over cycle-02 — 2026-09-10

## Qué pasó

Ensanchar `ServiceCapabilities` con `voiceQueue` en `apps/web` rompió el `build` en cinco fixtures de
spec con `lint` y `test` en verde. Dos de esos cinco **no** los detectó TypeScript: los fixtures que
arman el objeto inline y terminan con `...overrides` compilan sin la propiedad nueva, porque el spread
impide probar que falta. Compilaron, y recién fallaron en runtime al aserar la lista de capabilities
que el badge de salud dibuja. Los otros tres sí los marcó `tsc` — y sólo `tsc`: el `build` de
`apps/web` typechequea los `*.spec.tsx`, a diferencia de las libs, que los excluyen del
`tsconfig.lib.json`.

Aparte, el gate de "≥ 35 % de memoria libre" que pedía el ciclo se calculó primero sobre `vm_stat`
sumando free + inactive + speculative y dividiendo por `hw.memsize`: dio **23,1 %** con el sistema
informando 47 %. La cuenta ignora la memoria comprimida, que en esta máquina son ~4,5 de 16 GB. El
número correcto ya lo publica `memory_pressure` como "System-wide memory free percentage" — que es un
dato distinto de su *nivel* de presión, lo único que `lessons.md` prohíbe usar.

## Lección

Al ensanchar un tipo compartido, buscar los fixtures que terminan en `...overrides`: el spread esconde
la propiedad faltante de `tsc` y el fallo aparece recién en runtime.

## Costo evitable

Dos ciclos de `build` → corregir → `build` (~3 min) por los fixtures que sí detectaba `tsc`, más una
corrida de `test` completa por los dos que no. Un `grep` de la clave hermana (`storyboardQueue`) antes
de tocar el tipo listaba los cinco de una: la primera pasada con regex multilínea sólo alcanzó a tres
porque dos estaban escritos inline. Y una bisección de ~5 min sobre el gate de memoria, evitable
comparando la métrica propia contra la que el sistema ya publica antes de confiar en ella.
