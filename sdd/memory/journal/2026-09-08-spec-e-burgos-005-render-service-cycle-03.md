# spec-e-burgos-005-render-service cycle-03 — 2026-09-08

## Qué pasó

1. **Un puerto que recibe un documento con paths relativos y no recibe su raíz es un defecto de
   contrato, y ningún doble puede verlo.** `MixTimelineAudioInput` era `{ timeline, outPath }`
   desde `cycle-01`. `Timeline.assets[].path` que escribe `auto-montage` es **relativo al
   proyecto** (`raw/aroll/clip01.mp4`); `mixTimelineAudio` los pasa tal cual a ffmpeg y
   `ExecaCommandRunner` corre con el cwd del proceso de la API — la raíz del repo —, donde no
   existen. La etapa `render` no lo sufría porque `renderTimeline` ya recibía `publicDir`; `mux` y
   `verify` tampoco, porque sólo manejan paths absolutos. **307 tests, 96,79 % de cobertura y tres
   ciclos de suite verde no lo vieron nunca**: el doble del puerto no resuelve paths, y la única
   otra herramienta del repo que arma un pipeline (`tools/render-cli`) no llama a esa función. Lo
   encontró el smoke real **en su primera corrida**, con el job muriendo en `stage: mix` después de
   renderizar 538 frames. Se corrigió con `projectRoot` en el input y
   `runOptions: { cwd: projectRoot }` en el adaptador (D-30, addendum al `architect.md` §18); la
   lib no se tocó porque `MixTimelineAudioOptions.runOptions` ya lo soportaba.

2. **Un proceso que embebe Remotion no controla su propio exit code después de un render.**
   `SIGTERM` daba `exit=0` en el guion de `cycle-02` y `exit=143` en el de `cycle-03`. Aislado con
   dos corridas del mismo binario: sin render → `0`; con un job `succeeded` → `143`, en 46 ms (no
   es un cuelgue). Causa: `@remotion/renderer` instala sus propios handlers de señal para cerrar el
   browser que mantiene vivo (`BrowserRunner.js:191-196`), y terminan el proceso con el status de
   la señal antes de que `server.close()` complete. Un `process.exit(0)` explícito se probó,
   **midió 143 igual**, y se revirtió en vez de quedar como cambio sin efecto. Descopado con
   recomendación escrita: el arreglo limpio es el worker aparte, que es el mismo cambio que haría
   falta para subir la concurrencia.

## Lección

Un puerto que transporta paths relativos sin transportar su raíz es un bug que sólo aparece con
binarios reales; y una dependencia que instala handlers de señal se lleva puesto el exit code del
proceso que la embebe — las dos son cosas que ninguna suite con dobles puede ver, y las dos las
paga el primer smoke real si se corre temprano.

## Costo evitable

El smoke encontró D-30 en su primera corrida, después de 22 tasks cerradas y de un render completo
de 538 frames (~22 s de máquina más el diagnóstico y la corrección del puerto, dos archivos y dos
tests). Se evitaba con una regla barata al diseñar un puerto: **si el input lleva un documento con
paths relativos, el input lleva también su raíz** — la misma que `renderTimeline` ya cumplía con
`publicDir` y que el contrato de `mix` no copió. Sobre el exit code: dos corridas de aislamiento
(~5 min) fueron lo que convirtió "el smoke falla" en "el smoke pasa y esto es un límite conocido"
— aislar antes de arreglar evitó el `process.exit(0)` que no arreglaba nada.
