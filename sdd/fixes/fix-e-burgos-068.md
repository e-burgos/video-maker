# FIX-e-burgos-068 — Niveles nuevos de la cama de música en el productor

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-068 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
FIX-067 bajó 2 dB la cama de música de los presets del montaje para que el margen de la voz llegue a 15 dB. El SKILL.md y el prompt del productor seguían citando los niveles viejos, y la receta Publicidad del prompt subía la música a mano a −4/−12 dB.

## Solución
| Lugar | Antes | Ahora |
| --- | --- | --- |
| SKILL.md, tabla de presets: `software-demo`, `educational` y `recipe` | −8 / −18 dB | −10 / −20 dB |
| SKILL.md, tabla de presets: `hardware` | −4 / −12 dB | −6 / −14 dB |
| SKILL.md, receta Tutorial | −8 / −18 dB | −10 / −20 dB |
| `build-producer-prompt.ts`, receta Tutorial | −8 / −18 dB | −10 / −20 dB |
| `build-producer-prompt.ts`, receta Publicidad | −4 / −12 dB | −6 / −14 dB |

## Verificación
- producer-tools en verde (449), con el checklist de las recetas actualizado.
- auto-montage (381) y render-api (2291), también en verde.
