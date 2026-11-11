# FIX-e-burgos-072 — Timeout de review-measurements y tipos de dos specs

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-072 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
- **`review-measurements.spec.ts`:** el caso del fallback de duración carga `@video-maker/media-local` con un `import()` dinámico. Al ser la primera carga de la librería, en corridas paralelas superaba los 5 s y fallaba de forma intermitente.
- **`music-handler.spec.ts` y `motion-level-plans.spec.ts`:** tenían errores de `tsc`, por usar `.shape` sobre un `ZodTypeAny` y acceder a `plan.sfx` sin el opcional.

## Solución
- La carga de media-local se precalienta en un `beforeAll` con 60 s de margen, así el caso mide el fallback y no el tiempo de importación.
- Se agregan casts a `ZodObject` y el acceso opcional `plan?.sfx?.[0]`.

## Verificación
- Los specs afectados pasan.
- `tsc` del `tsconfig.spec` de render-api baja de 132 a 129 errores.

## Fuera de esta PR
Quedan 129 errores de tipos en 18 specs de render-api: producer, storyboard, handle-request, entre otros. Todos son anteriores a esta PR.
