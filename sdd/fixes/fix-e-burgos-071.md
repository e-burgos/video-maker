# FIX-e-burgos-071 — Máster del modo B con ganancia lineal y limitador

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-071 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El máster de los videos motion (`normalizeVideoMasterLoudness`) seguía con `loudnorm` de dos pasadas, que cae a modo dinámico. Combinado con el reintento de pico de FIX-049, dejaba algunos videos bajos de volumen: el vertical de prueba salía a −15,8 LUFS con el pico en −3,4 dBTP.

## Solución
- **Misma cadena que el montaje (FIX-064):** una ganancia lineal hasta −14 LUFS y un `alimiter` a 192 kHz con techo en el target de pico. La cadena queda en `masterNormalizationFilters`, compartida por los dos másters.
- **Se mantiene** la medición del MP4 codificado y el reintento de pico de FIX-049 (`masterRetryFor`).

## Antes y después
Renders reales del modo B en el studio:

| Video | I (LUFS) | Pico (dBTP) | LRA (LU) | Destellos |
| --- | --- | --- | --- | --- |
| `prueba-integracion-16x9` | −14,0 → −14,0 | −1,3 → −1,4 | 4,1 → 4,1 | 0 |
| `prueba-integracion-vertical` | −15,8 → −14,8 | −3,4 → −1,5 | 4,4 → 4,5 | 0 |

## Descartado
Se probó un reintento que subía la ganancia cuando el limitador dejaba el máster más de 0,5 LU por debajo de −14. En el vertical llevó el pico a −0,9 dBTP, por encima del techo, y solo ganó 0,1 LU. Se sacó.

Un video con picos muy densos puede quedar hasta 1 LU por debajo de −14, que está dentro de la tolerancia del review.

## Verificación
`nx test` y `lint` de media-local en verde (452).
