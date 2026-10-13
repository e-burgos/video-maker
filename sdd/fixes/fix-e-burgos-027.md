# FIX-e-burgos-027 — El cursor no crece con el zoom de la cámara y las franjas anchas y finas se encuadran legibles

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-027 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- El cursor y el punto del globo se agrandaban con el zoom automático, y franjas como «Falta validar tu email» quedaban chicas porque la cámara encuadraba toda la franja.

## Solución
- La cámara automática contra-escala el cursor (`.mg-ui-pin`) y el ancla del globo (`--mg-inv`) como a los globos. Franjas finas (`h ≤ 0,07` y `w/h ≥ 5`) se encuadran desde su inicio con un lado `clamp(h/0,08, mín, 0,8)` para que ocupen ≥8 % del alto, hasta 3× (`STRIP_MIN_SIDE = 0,33`); una franja nunca comparte encuadre con otro paso. El cursor base sube a `max(52px, 3.9cqw)` para que su tamaño constante se vea. El prompt y la guía de escena dejan de pedir zoom manual por legibilidad: la franja lleva su propio resaltado y la cámara la encuadra.
- Hallazgo en la verificación: en el v2 el productor había puesto un zoom manual sobre la franja, que apaga la cámara automática.

## Verificación
- motion-graphics y producer-tools lint/test/build verde. Render real sobre copia del v2 (hoja de contacto antes/después): el cursor queda de tamaño fijo (~45 px en 1080p) durante el zoom; el aviso «Falta validar tu email…» se lee con zoom 3× al inicio de la franja y el clic en «Reenviar email» tiene su propio encuadre.
