# FIX-e-burgos-060 — Efectos de sonido de los bumpers en el máster del montaje

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-060 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Motion publicó el contrato de efectos de los bumpers: `planBumperSfx` (FIX-057), que dice qué tipo de efecto va, cuándo y con qué `gainDb`. Faltaba que el máster del montaje los mezclara con archivos reales.

## Solución
- **Resolución** (`apps/render-api/src/sfx/resolve-bumper-sfx.ts`):
  - **Cues automáticos:** cada uno toma una variante del banco (FIX-059) con la semilla del video, sin repetir la anterior. Su gain hace que el efecto suene `gainDb` dB por debajo del target de voz, partiendo del nivel medido en el banco.
  - **Cues explícitos:** usan su asset de la timeline y su gain.
- **Mezcla** (`media-local`): cada efecto es una entrada más del `amix`, con resample, estéreo, fundidos, `volume` y `adelay` en tiempo absoluto. Pasan por el mismo limitador de bus y por la normalización con reintento de true peak de FIX-049.
- **Banco:** el adapter de render-api lo lee de `motionAssetsRoot/sfx-bank`. Si no está, mezcla sin efectos.
- **Créditos:** después de mezclar, los efectos CC BY usados se agregan a `work/credits.json` como `kind: sfx` (`sfx-bank/<archivo>`), sin duplicar entre renders. Los CC0 no se acreditan porque no lo requieren.

## Niveles
Con la voz a −14 LUFS, el loudness momentáneo de cada efecto queda en:

| Efecto | Nivel |
| --- | --- |
| Whoosh | −28 |
| Impacto | −26 |
| Brillo | −30 |
| Clicks | −38 |

En los bumpers no habla nadie, y aun así los efectos quedan 12 dB o más por debajo de la voz.

## Verificación
- `nx test` y `lint` en verde: media-local (449) y render-api (2282).
- Tests nuevos: el grafo con efectos, la resolución, las variantes que no se repiten, los cues explícitos y los créditos.
