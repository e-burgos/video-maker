# FIX-e-burgos-026 — La revisión visual extrae varios cuadros por escena y exige verlos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-026 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Con un solo cuadro por escena la revisión no veía cuando la voz nombra algo que aparece en otro momento de la escena (caso Easy Pro del video de prueba).

## Solución
- `review/scene-frame-plan.ts`: 1 cuadro si la escena dura ≤6 s y la voz nombra ≤1 elemento; si no, `clamp(max(ceil(dur/3), elementos), 2, 5)` cuadros repartidos. `SceneFrame` pasa a `frames[]` (lee el formato viejo). `record_visual_review` falla con `VISUAL_REVIEW_NOT_VIEWED` nombrando escena y cuadros sin ver; la web muestra todos los cuadros.

## Verificación
- render-api, timeline-core, producer-tools y web lint/test/build verde.
