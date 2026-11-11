# FIX-e-burgos-041 — Regla de variedad del productor (etapa 7 de motion graphics)

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-041 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Etapa 7 de `docs/research/2026-11-10-motion-graphics-productor.md`. Ni las skills ni el prompt del productor pedían variedad. Las recetas mandaban `seed: 0`, así que dos videos del mismo preset rotaban igual.

## Solución
- **render-api.** Si el job `montage` llega sin `seed`, la semilla sale del slug del video (`seedForVideo`). Antes valía siempre 0.
- **Prompt del productor.** Nueva sección «Variety: never two cuts alike»: no mandar `seed`, salvo para reproducir o para "otra versión" del mismo video. En motion, nunca dos escenas seguidas del mismo `kind` ni con la misma `exit`, y cortes fuertes solo antes de un capítulo. Las recetas Tutorial y Publicidad dejan de fijar `seed: 0`.
- **Storyboard automático.** El system prompt suma la misma regla de `kind` y `exit`.
- **Skills.** `motion-studio` documenta `exit` y la regla de variedad dentro del video y entre videos de la misma lista. `video-producer` explica el pool rotativo, la semilla por video y el `--seed` del CLI.
- **Fuera de alcance:** los bumpers de las recetas siguen fijos (`slide-up` y `zoom`). Rotarlos es la etapa 2. El formulario manual de montaje de la web sigue proponiendo semilla 0.

## Verificación
- `nx test` y `lint` en verde para producer-tools (448), render-api (2265) y motion-graphics (326).
