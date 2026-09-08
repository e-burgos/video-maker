# spec-e-burgos-003 cycle-02 — 2026-09-07

## Qué pasó

1. **Un CA verde tapando un camino muerto en producción.** El plan de caja de captions
   (`captionClipPlan`) recibe `boxSource`. Con default `'clip'` el resultado habría sido correcto en
   todos los tests unitarios —que arman su propio `CaptionSequenceProps`— y sin embargo habría dejado
   inalcanzable en producción todo el trabajo de cycle-01 (safe zones por plataforma, anchor,
   `boxHeightRatio`), porque `buildTimeline` de `timeline-core` SIEMPRE rellena `CaptionClip.box`. Lo
   detectó el architect leyendo el **productor** del dato (`build-timeline.ts`), no el consumidor.
   El test que lo fija no usa un fixture inventado: corre contra la `Timeline` real de
   `buildExampleTimeline` y asserta las dos ramas.
2. **Un target manual que nunca se había ejecutado no estaba verificado.** `nx run
   composition-remotion:smoke` falla con `Cannot find module '../../libs/timeline-core/src'` —
   `@swc-node/register` sin `tsconfig-paths` no resuelve el alias del workspace. El target nació en
   `spec-001 cycle-03` con su CA aceptado como "procedimiento documentado, nunca ejecutado": estuvo
   roto desde el día uno y nadie lo supo hasta que este ciclo intentó correrlo (dos veces, con
   memoria verificada).
3. **`tasks.json` corrompido por edición manual.** El orquestador insertó un bloque `usage` a mano y
   cerró con `]` en vez de `}`. `pnpm sdd:validate` no corrió en ese momento; el JSON inválido lo
   descubrió el implementador al abrir la task siguiente.

## Lección

- Antes de darle un default a un flag que elige entre dos fuentes de un dato, leer quién **produce**
  ese dato: si el productor siempre lo rellena, el default equivocado desactiva features enteras sin
  romper un solo test. El test que lo protege tiene que correr contra el productor real, no contra un
  fixture armado a mano.
- Un CA aceptado como "procedimiento documentado, nunca ejecutado" no es evidencia de que funcione:
  o se ejecuta una vez al cerrarlo, o se registra explícitamente como no verificado.
- Toda edición a mano de un `*.json` de `sdd/` se cierra corriendo `pnpm sdd:validate` en el acto;
  no al final del ciclo.

## Costo evitable

- Los dos intentos de `smoke` (bundle de Remotion + verificación de memoria libre, ~15 min de
  máquina) se habrían ahorrado si `spec-001 cycle-03` hubiera corrido el target una vez, o hubiera
  dejado el follow-up escrito.
- El `tasks.json` roto costó una lectura completa del archivo, el diagnóstico y la reescritura del
  bloque en la task siguiente: unos pocos miles de tokens que un `sdd:validate` de 2 segundos
  habría evitado.
