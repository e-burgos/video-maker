# FIX-e-burgos-064 — Máster del montaje con ganancia lineal y limitador

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-064 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
`normalizeMasterLoudness` normalizaba con `loudnorm` en dos pasadas. Cuando llevar el máster a −14 LUFS empujaba el pico por encima del techo, `loudnorm` pasaba a modo **dinámico**, que actúa como un control automático de ganancia: sube más los tramos callados.

En el video de prueba con bumpers, el impacto del intro estaba a −26 LUFS en la mezcla cruda, como se diseñó, y salía a −14,8 en el máster: 11 dB más fuerte. Además el modo dinámico achataba el rango (LRA) de los videos publicados.

## Solución
- **Ganancia lineal:** una sola ganancia hasta el target integrado (−14 LUFS).
- **Limitador:** `alimiter` con techo en el target de pico (−1 dBTP menos 0,5 dB de margen), con ataque de 1 ms, release de 60 ms y compensación de latencia. Corre a 192 kHz para atrapar también los picos entre muestras.
- **Sin cambios:** la sonda AAC y el reintento de FIX-049 se mantienen; ahora bajan el techo del limitador.
- **Alcance:** solo el máster del montaje. El del modo B (`normalizeVideoMasterLoudness`) sigue con `loudnorm`, porque no tiene bumpers de timeline.

## Antes y después
Tres másters reales: la mezcla cruda de cada uno, normalizada y codificada a AAC 192k como en el mux. Los proyectos solo se leyeron; los resultados quedaron en el scratchpad.

| Video | I (LUFS) | Pico (dBTP) | LRA (LU), cruda | Efecto del intro (M máx) | Voz (M máx) |
| --- | --- | --- | --- | --- | --- |
| Webs `opticagestion-clientes` (publicado) | −14,1 → −14,0 | −1,4 → −1,5 | 9,3 → 10,4 (10,4) | sin efecto | −8,7 → −8,6 |
| Display Ads `display-ads-usuarios` (publicado) | −14,0 → −13,9 | −1,3 → −1,5 | 8,6 → 10,6 (10,6) | sin efecto | −7,0 → −7,4 |
| `prueba-motion-guion` (bumpers con SFX) | −14,0 → −14,0 | −1,4 → −1,4 | 4,7 → 5,0 (5,1) | −14,8 → −18,2 | −9,4 → −9,2 |

- **Loudness y pico:** los tres siguen en −14 LUFS y con el pico ≤ −1,4 dBTP, sin usar el reintento.
- **Rango (LRA):** queda igual al de la mezcla cruda, sin el aplastamiento del modo dinámico.
- **Efecto del intro:** baja 3,4 dB y queda unos 9 dB por debajo de la voz, como se diseñó.

## Verificación
- `nx test` y `lint` en verde: media-local (450) y render-api (2291).
- `review-measurements` dio el timeout suelto conocido y pasa corrido solo.
