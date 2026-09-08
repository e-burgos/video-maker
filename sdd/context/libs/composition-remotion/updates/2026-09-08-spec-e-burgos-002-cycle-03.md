# spec-e-burgos-002 cycle-03 — 2026-09-08

> Ciclo de **carril paralelo** sobre esta lib (HC-2): spec-003 la está modificando en otra rama.
> Este ciclo tocó **un solo archivo y una sola línea**. Fragmento acotado a propósito.

## Estado

- **D-4 quedó cableado end-to-end: el punch-in ahora respeta el `anchor` de la escena.**
  `src/components/aroll-series.tsx`, en `ArollScene`:
  `punchInStyle(scene.transform)` → `punchInStyle(scene.transform, scene.transform.anchor)`.
  Hasta ahora `punchInStyle` recibía el `anchor` opcional pero nadie se lo pasaba, así que **todo
  punch-in escalaba desde el centro** aunque el EDL dijera otra cosa. `ClipTransform` incluye
  `anchor` desde cycle-02 de spec-002; el helper ya estaba listo, faltaba el call site.
- **Verificado en render real, no por test** (CA-015 de spec-002): 2 decisiones `punch-in` con
  `anchor: 'face-hint'` en el EDL se propagaron a 2 clips de la Timeline y, en la reproducción, los
  punch-ins escalan desde el tercio superior en vez de desde el centro. Es la única verificación
  posible: `ArollScene` no se exporta y `src/components/**` no está en el `include` de cobertura
  (`['src/helpers/**/*.ts', 'src/transitions/**/*.ts']`), así que el umbral de la lib no se movió.
- **`FIX-e-burgos-001-001` queda validado por este ciclo.** El fix (cherry-pick `95d56f6`, que trae
  `withWorkspaceAliases` en `src/render.ts`, `tsconfig.smoke.json`, `src/smoke-register.cjs` y el
  cambio del target `smoke`) pasó de `implemented` a `validated` en `sdd/fixes.json`: los dos
  renders reales de este ciclo ejercieron el mismo camino
  (`remotionRenderDeps.bundleProject` → `withWorkspaceAliases`) desde un consumidor distinto
  (`tools/render-cli`), sin volver a tocar la lib.

## Estructura

Sin cambios de estructura. **Nada más de esta lib fue tocado por este ciclo**: ni el barrel
(`src/index.ts`), ni `README.md`, ni `vite.config.ts`, ni `project.json`, ni `src/render.ts`. Los
otros 6 archivos que el branch trae modificados vienen del cherry-pick del fix, no de este ciclo.

## Dependencias

Sin cambios. **Nuevo consumidor externo: `tools/render-cli`**, que la usa **solo** por el subpath
`@video-maker/composition-remotion/render` (`renderTimeline` + `RenderTimelineError`), nunca por el
barrel — precisamente para no colisionar con spec-003, cuyo cycle-02 saca `CaptionTrack` y
`captionLayout` del barrel. Ese contrato conviene preservarlo: hoy la lib puede reorganizar su
barrel sin romper la CLI.

## Qué sigue

- `src/components/**` sigue **sin tests y fuera de la cobertura**. El cableado de `anchor` está
  verificado por render real y por nada más: si alguien refactoriza `ArollScene`, no hay red que
  avise que el punch-in volvió al centro. N-3 del `architect.md` de cycle-03 deja anotado que la
  premisa de que hacía falta tocar `vite.config.ts` para testear el componente **es falsa** —
  `vite.config.ts` ya declara `include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx']`, `jsdom` y el
  plugin de React. El obstáculo real es otro y es menor: `ArollScene` no está exportado y montar
  `ArollSeries` exige el contexto de frame de Remotion.
- Al mergear con el carril de spec-003, el punto de conflicto no es este fragmento ni
  `aroll-series.tsx` (una línea, aislada), sino los 6 archivos del cherry-pick del fix.
