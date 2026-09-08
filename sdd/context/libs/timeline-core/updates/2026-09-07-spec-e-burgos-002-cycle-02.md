# spec-e-burgos-002 cycle-02 — 2026-09-07

## Estado

`ClipTransform` (en `tracks.aroll[]`/`tracks.broll[]`) gana un campo opcional `anchor:
PunchInAnchor`. `buildTimeline` lo propaga desde `PunchInDecision.anchor` únicamente al
sub-rango con zoom que ese punch-in genera; los sub-ranges sin zoom (antes y después) nunca
lo llevan. Cambio aditivo y retrocompatible: ningún test existente de `timeline-core`
cambió de resultado.

## Estructura

- `src/schemas/timeline.schema.ts`: `ClipTransformSchema` importa `PunchInAnchorSchema` de
  `./edit-decision-list.schema` y agrega `anchor: PunchInAnchorSchema.optional()`.
- `src/timeline/build-timeline.ts`: `KeepSubRange` gana `anchor?: PunchInAnchor` (tipo
  importado de `../punch-in/plan-punch-ins`, ya exportado por el barrel — es la misma unión
  literal que `z.infer<typeof PunchInAnchorSchema>`); `splitKeepByPunchIns` y el `transform`
  del clip A-roll lo propagan con el helper existente `optionalField`.
- `libs/timeline-core/schemas/timeline.schema.json` regenerado (`nx run
  timeline-core:schemas`): `anchor` aparece en `transform` de `tracks.aroll[]` y
  `tracks.broll[]`; `required` no cambió. `edit-decision-list.schema.json` no cambió.
- Superficie pública del barrel (`index.ts`) sin cambios: `PunchInAnchorSchema` y
  `ClipTransformSchema` siguen sin exportarse ahí.

## Qué sigue

Con esto el anchor llega íntegro hasta `work/timeline.json`. Falta que `cycle-03` cablee
`libs/composition-remotion/src/components/aroll-series.tsx` para pasarle
`scene.transform.anchor` a `punchInStyle` (helper y tests ya existen ahí desde antes). Esa
lib debe escribir su propio fragmento en `sdd/context/libs/composition-remotion/updates/`
al hacerlo.
