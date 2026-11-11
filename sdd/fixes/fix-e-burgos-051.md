# FIX-e-burgos-051 — La marca llega a los bumpers y las recetas dejan de fijar su animación

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-051 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Cierra lo que dejó pendiente el FIX-e-burgos-050. Los bumpers rotaban con un celeste por defecto y sin la web de la marca, porque render-api no le pasaba la paleta al montaje. Además, las recetas del productor seguían pidiendo intro `slide-up` y outro `zoom`.

## Solución
- **render-api.**
  - `brandBumperStyle` arma el estilo de bumpers desde el manifiesto: acento y secundario de la paleta, la web (o el `outroCaption` del bloque `bumpers`) como remate del outro, y los pools del bloque.
  - Descarta colores que no son hex de 6 dígitos y remates de más de 60 caracteres, para que la timeline siempre valide.
  - `runMontagePipeline` lo pasa como `brand.bumperStyle`.
- **Prompt del productor.**
  - Las recetas Tutorial y Publicidad prenden los bumpers sin `background`, `reveal` ni `caption`.
  - La sección de variedad explica que el studio los rota por video y que `style` no se manda.

## Verificación
- `nx test` y `lint` en verde para render-api (2277; un test de probe de medios hizo timeout bajo carga y pasa aislado) y producer-tools (448).
- `build` de render-api en verde.
