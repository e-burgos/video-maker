# FIX-e-burgos-001-002 — `coverage.include` de `composition-remotion` no mide `src/render.ts` ni `src/components/**`

| Campo         | Valor                                             |
| ------------- | ------------------------------------------------- |
| **ID**        | FIX-e-burgos-001-002                              |
| **Tipo**      | IMPROVEMENT                                       |
| **Severidad** | medium                                            |
| **Keyword**   | [IMPROVEMENT]                                     |
| **Fecha**     | 2026-09-08                                        |
| **Autor**     | e-burgos                                          |
| **Estado**    | implemented                                       |
| **Spec**      | spec-e-burgos-001-core-composition-media-pipeline |
| **Origen**    | D-6 de `spec-e-burgos-005-render-service`, agendado para `cycle-03` |

## Problema

`libs/composition-remotion/vite.config.ts` declara:

```ts
include: ['src/helpers/**/*.ts', 'src/transitions/**/*.ts'],
thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
```

El piso del 80 % se mide sobre **dos** subdirectorios. `src/render.ts` — el archivo que bundlea y
renderiza, el más caro y el más frágil de la lib — y `src/components/**` quedan afuera: no cuentan
para el piso ni aparecen en el reporte. Es exactamente la trampa que la lección del repo describe:
*"leer `coverage.include` antes de confiar en un piso: un piso que no incluye los archivos del
ciclo no es evidencia de nada"*. Durante dos specs el smoke de esta lib estuvo roto
(`FIX-e-burgos-001-001`) con la cobertura en verde.

## Solución aplicada

`coverage.include` pasa a `['src/helpers/**/*.ts', 'src/transitions/**/*.ts', 'src/render.ts']`.
El piso global del 80 % **no se toca**: con `render.ts` medido, la lib da **93,33 % stmts ·
92,19 % branch · 90,47 % funcs · 93,18 % lines** (antes, sobre dos subdirectorios: 97,61 % / 92,23 %
/ 100 % / 97,56 %). `render.ts` aparece por primera vez en el reporte, con **76,92 % stmts ·
87,5 % branch · 54,54 % funcs · 76,31 % lines** y las líneas 18, 100-121 y 131 descubiertas: eso es
exactamente la información que el `include` viejo ocultaba.

`vite.config.ts` **no** está protegido por el hook `config-protection` (que matchea por basename
`eslint.config.mjs` / `tsconfig.base.json`): la edición pasó sin bloqueo.

## `src/components/**` — descopado con recomendación escrita

El brief de `spec-005 cycle-03` pedía ampliar también a `src/components/**`. **Se descopa, y la
decisión queda acá.** Medido: incluir `src/components/**/*.tsx` deja la lib en **80,06 % stmts ·
79,64 % branch · 68,53 % funcs · 80 % lines** — dos ejes por debajo del piso de RNF-2.

La salida autorizada por el brief era bajar el piso **sólo para los archivos nuevos** con
`thresholds` por glob de Vitest. **No funciona en este proyecto**: se probó con las claves
`'src/components/**/*.tsx'`, `'**/src/components/**/*.tsx'` y `'**/components/**'` sobre Vitest
4.1.11 y en las tres los archivos siguieron contando para el umbral global
(`ERROR: Coverage for functions (68.53%) does not meet global threshold (80%)`). Sin piso por
archivo disponible, la única forma de incluirlos era bajar el umbral **global** de 80 % a ~68 %,
que es precisamente ocultar la deuda en vez de registrarla.

**Recomendación:** la cobertura honesta de `src/components/**` no es un ajuste de config sino
tests que rendericen los componentes por su camino real. Son componentes Remotion
(`<Series>`, `<OffthreadVideo>`, `<Audio>`): en `jsdom` sólo se ejercita el árbol de props, que es
lo que ya cubren `timeline-composition.spec.tsx` y `kinetic-captions.spec.tsx`. El consumidor que
los va a montar de verdad es el Remotion Player de `apps/web` (`spec-e-burgos-006-web-studio`):
**ese** es el ciclo donde medirlos sale barato y significa algo. Hasta entonces, la evidencia de
que los componentes renderizan es el smoke E2E con binarios reales, no el reporte de v8.

## Justificación del bypass del SPEC GATE

Cambio de configuración de medición en una spec ya `completed`. No toca código de producción, no
cambia ninguna API pública, ningún contrato ni ninguna dependencia. Abrir un ciclo SDD completo
para ajustar un `include` de cobertura es desproporcionado. `cycle-03` de `spec-005` es el primer
ciclo que ejercita `render.ts` de verdad (smoke E2E con binarios reales), así que es el momento en
que la ampliación tiene evidencia detrás.

## Archivos afectados

- `libs/composition-remotion/vite.config.ts`

## Verificación

`pnpm nx run composition-remotion:test` en verde con el `include` ampliado (2026-09-08), reporte de
cobertura con la fila `src/render.ts` presente y el piso global de 80 % intacto en los cuatro ejes.
