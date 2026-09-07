# spec-e-burgos-001-core-composition-media-pipeline cycle-03 — 2026-09-07

## Qué pasó

1. **El límite de sesión de la API cortó al planner y al arquitecto a mitad de su corrida, y el
   planner dejó `planner.md` completo pero sin `tasks.json`.** El documento largo se escribe primero
   y el registro de máquina queda para el final, así que un corte a mitad deja el ciclo en el peor
   estado posible: un ciclo que *parece* planificado (el `.md` está ahí, revisable) pero que no puede
   arrancar ninguna task ni pasar el SPEC GATE. Recuperarlo costó una segunda corrida completa del
   planner, que tuvo que releer functional + spec + brief solo para emitir el JSON que ya había
   decidido en la primera. Por eso la entrada `planner` de `by_agent` quedó `approx: true`: mezcla un
   run no medido (cortado) con uno medido.
2. **`@nx/react:lib` deja siete paquetes y dos bloques de config que la lib no usa.** Con
   `--linter=eslint` el generador instaló `@babel/core`, `@babel/preset-react` (+ `.babelrc`),
   `eslint-plugin-import`/`jsx-a11y`/`react`/`react-hooks` y `@vitest/ui`, y volvió a registrar los
   plugins inferidos `@nx/eslint/plugin` y `@nx/vitest` en `nx.json`. Nada de eso lo consume el
   proyecto: la lib compila con `tsc`, testea con `@vitejs/plugin-react` y extiende el
   `eslint.config.mjs` raíz sin `flat/react`. La task de scaffold los detectó y los removió en el
   acto (`pnpm remove -w` + `git checkout -- nx.json`), pero un `export {};` residual del generador
   en `src/index.ts` se le escapó y sobrevivió seis tasks, hasta la auditoría del barrel en
   TASK-007.
3. **`exactOptionalPropertyTypes: true` choca de frente con los genéricos de Remotion, tres veces en
   el mismo ciclo.** (a) Una `interface` nunca satisface `Props extends Record<string, unknown>` de
   `<Composition>` — hubo que declarar `TimelineCompositionProps` y `TimelineInputProps` como `type`
   (un alias de tipo objeto sí tiene índice implícito). (b) `TransitionSeries.Transition` es genérico
   en un único `PresentationProps` y rechaza el tipo unión `ArollPresentation`, lo que obligó al único
   cast de la lib (`widenPresentation`). (c) Pasar `direction: undefined` en vez de omitir la clave no
   compila. Ninguno se ve venir leyendo la doc de Remotion: los ejemplos oficiales usan `type` sin
   explicar por qué.
4. **`await import()` dinámico dentro del default de producción fue lo que mantuvo los paquetes
   nativos fuera de CI.** `remotionRenderDeps` no importa `@remotion/bundler`/`@remotion/renderer` en
   el tope del módulo: los carga dentro de cada método. Así `render.spec.ts` puede importar `render.ts`
   y probar hasta el default sin que Node resuelva un solo paquete nativo — el gate de "cero Chrome en
   CI" (RNF-3) queda garantizado por la forma del import, no por la disciplina de cada test.

## Lección

- Un agente planner escribe **`tasks.json` primero y `planner.md` después**: el registro de máquina es
  lo que desbloquea el ciclo, el documento narrativo es reconstruible. Vale para cualquier agente cuya
  unidad de trabajo produzca un `.md` largo y un JSON corto.
- Después de scaffoldear con un generador de Nx, auditar en la MISMA task tres lugares, no dos:
  `package.json` (dependencias que nada importa), `nx.json` (plugins inferidos que el generador
  vuelve a registrar) y los archivos que dejó en `src/` (placeholders, `export {};`). Lo que no se
  poda ahí sobrevive el ciclo entero.
- Con `exactOptionalPropertyTypes: true`, los props de un componente de librería genérica se declaran
  como `type`, nunca como `interface`, y las claves opcionales se **omiten** en vez de asignarles
  `undefined`.
- Para mantener un binario o paquete nativo fuera de CI, cargarlo con `await import()` dentro del
  método que lo usa, no con un import de tope de módulo: el aislamiento pasa a ser estructural y no
  depende de que cada test recuerde inyectar un doble.

## Costo evitable

- La segunda corrida del planner (~190K tokens) fue enteramente re-trabajo: releer functional, spec y
  brief para volver a emitir tasks ya decididas. Con el orden `tasks.json` → `planner.md`, el corte
  habría dejado el ciclo arrancable y solo faltaría redactar el documento.
- Los tres choques con `exactOptionalPropertyTypes` se descubrieron uno por task (TASK-005, TASK-006,
  TASK-007), cada uno con su ida y vuelta de compilación. Anotado en la constitución de la lib, el
  próximo consumidor de Remotion en este repo los evita de entrada.
