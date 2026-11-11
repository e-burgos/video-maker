# FIX-e-burgos-061 — Reglas de review contra la ametralladora de efectos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-061 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El review medía cuánto tapaban los efectos a la voz, pero no si había demasiados ni si se repetían. El criterio de Real SFX (informe de audio, §3) dice:

- nunca 5 o más sonidos iguales seguidos;
- los golpes, en pocos momentos;
- sin amontonar efectos.

## Solución
- **`sfx-repetition`:** 5 o más efectos iguales seguidos, en orden de tiempo. Variantes distintas cuentan como sonidos distintos.
- **`sfx-density`:** más de 4 efectos en 3 s, o más de 20 por minuto en todo el video.
- **Fuentes:**
  - modo B: los `<audio id="sfx-…">` del `index.html` compuesto, identificados por nombre de archivo;
  - montaje: los efectos de los bumpers (`planBumperSfx`), por tipo o por asset.
- **Severidad:** las dos son **sugerencias**, no críticas.

## Por qué sugerencia
Calibrado sobre 3 videos motion reales, todos repiten el mismo `whoosh.mp3` en cada corte:

| Video | Whoosh iguales seguidos |
| --- | --- |
| `prueba-integracion-16x9` | 6 |
| `prueba-integracion-vertical` | 5 |
| `display-ads-presentacion` | 8 |

La densidad es baja: 1 efecto cada 3 s como máximo. Como crítica, la regla bloquearía todo el modo B. El arreglo de fondo es de motion: rotar las variantes del banco de FIX-059 en `compose-template.ts`.

## Verificación
- `nx test` y `lint` de render-api en verde (2288).
- Tests: el caso real de 6 whoosh, 4 seguidos que pasan, el orden por tiempo, variantes distintas, la ventana de 3 s y el promedio por minuto.
