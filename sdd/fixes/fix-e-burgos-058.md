# FIX-e-burgos-058 — Selector de sonido de los bumpers en la web

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-058 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El contrato de efectos de sonido del FIX-e-burgos-057 no tenía cómo elegirse a mano desde el studio. Además, la composición repetía su propio tiempo de entrada del logo, lo que podía desfasar el golpe del sonido respecto de la imagen.

## Solución
- **web.** El editor de bumpers suma «Sonido» con estas opciones: automático (cuando la timeline rota), whoosh, golpe, brillo, clicks o sin sonido. La elección escribe `sfxKind`, gana sobre la rotación y "automático" la borra.
- **composition-remotion.** El tiempo de entrada del logo sale de `BUMPER_REVEAL_ENTER_MS` del contrato, así el golpe cae cuando aterriza el logo. La escena expone `data-sfx` para los tests.
- **Prompt del productor.** Los bumpers suenan solos. El productor deja `sfxKind` y `sfx` afuera, salvo que el usuario pida un sonido concreto o silencio (`"sfxKind":"none"`). Esta regla tiene el OK de la sesión orquestadora.
- La mezcla del sonido en el máster es de la sesión de música: el reproductor de vista previa no reproduce los efectos.

## Verificación
- `nx test`, `lint` y `build` en verde: composition-remotion 379, web 1653, producer-tools 449.
