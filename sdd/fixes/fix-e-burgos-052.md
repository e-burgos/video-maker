# FIX-e-burgos-052 — Bumpers por piezas en el SKILL.md del productor

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-052 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
La sección §4 del SKILL.md seguía mostrando el formato viejo de bumpers: `backgroundColor` más `animation` (`fade` | `zoom` | `slide-up`). Desde FIX-050 y FIX-051, el montaje rota fondo, revelado y remate por video con el estilo de la marca, y el productor podía pisar esa rotación fijando el look a mano.

## Solución
- El ejemplo prende intro y outro solo con `enabled`, `durationMs` y `logoWidthRatio`.
- **Regla:** no mandar `background`, `reveal`, `caption` ni `bumpers.style`. El montaje escribe `style` con `rotate: true`, una semilla por video y la paleta, la web y el bloque `bumpers` de la marca.
- **Qué se respeta con la rotación activa:** `background` y `reveal` propios no se aplican. `caption`, `backgroundColor` y `accentColor` sí, y van solo si el usuario los pide.
- `animation` queda marcado como campo viejo.

## Verificación
Sin código. Contrastado con `timeline.schema.ts`, `resolve-bumper-look.ts` y `auto-montage.ts`.
