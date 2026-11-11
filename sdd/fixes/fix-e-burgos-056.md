# FIX-e-burgos-056 — Bumpers en el SKILL.md del productor, corregido

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-056 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
- FIX-052 decía que, con la rotación activa, el `background` y el `reveal` propios de un bumper no se aplicaban. Es al revés: `resolve-bumper-look.ts` usa lo fijado en el bumper antes de rotar.
- La rotación por defecto ya no incluye `solid` ni `fade` (FIX-055), y el SKILL los seguía listando.
- La receta Tutorial fijaba intro `slide-up` y outro `zoom`, y su fila de música mandaba a Commons.

## Solución
- **Rotación:** se listan los pools que usa de verdad. Fondos: `gradient` | `noise` | `shapes` | `glow`. Revelados: `zoom` | `slide-up` | `wipe` | `blur-in` | `pop`. Nunca cae en la placa lisa con fundido, y si la marca define sus propios pools, rota entre esos.
- **Lo fijado a mano gana sobre la rotación:** `background` (incluido `solid`), `reveal` (incluido `fade`), `caption`, `backgroundColor` y `accentColor`. Se usan solo si el usuario pide ese look.
- **Receta Tutorial:** prende los bumpers sin `background`, `reveal` ni `style`.
- **Música de la receta:** `search_free_music` con «calm tutorial», que busca en el banco, después en Openverse y después en Commons.

## Verificación
Sin código. Contrastado con `libs/timeline-core/src/timeline/resolve-bumper-look.ts`.
