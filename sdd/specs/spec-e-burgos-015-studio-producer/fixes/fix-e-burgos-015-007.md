# FIX-e-burgos-015-007 — La receta Tutorial siempre cierra el video con una despedida

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-015-007 · IMPROVEMENT · low · 2026-09-21 · implemented |
| **Spec** | spec-e-burgos-015-studio-producer |
| **Origen** | El dev: "agregá a la receta Tutorial que al finalizar el video, si en el guion no hay mensaje de despedida, siempre se agrega uno". |

## Problema
La tabla de escenas que trae el usuario (o el guion que ya está en `work/producer/script.txt`) puede terminar en la última acción de la pantalla, sin despedirse del espectador. El video sale cortado y la placa de cierre entra sin cierre hablado.

## Solución
- API: la receta Tutorial del prompt del sistema suma la regla "THE SCRIPT ALWAYS ENDS WITH A FAREWELL" — antes de sintetizar la voz, el productor mira la última línea del guion y, si no se despide, agrega él una como última línea, en el idioma de la narración y con su propia marca `[m:ss]` sobre los segundos finales del A-roll (ejemplo: "¡Gracias por ver este tutorial! Nos vemos en el próximo."). No pide permiso, lo avisa en una línea al reconfirmar el guion y respeta la despedida del usuario cuando ya existe.
- Web: el prompt del chip de la receta dice lo mismo en los dos idiomas, para que el pedido que llega al chat ya lo contenga.

## Verificación
`pnpm nx run-many -t lint test -p web render-api` en verde (2026-09-21); casos nuevos en `producer-recipes.spec.ts` y `build-producer-system-prompt.spec.ts`.
