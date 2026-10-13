# FIX-e-burgos-017 — El zoom de la escena de interfaz se mantiene sobre los pasos que siguen

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-017 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-12 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el video de prueba "comprar producto" la captura ocupa ~55 % del ancho y la interfaz se lee poco. El paso `zoom`
  de `ui-walkthrough` volvía a la vista completa apenas empezaba el paso siguiente, así que los resaltados y clics
  siempre se veían sin zoom.

## Solución
- `ui-zoom` del runtime se mantiene hasta el próximo zoom de la escena o hasta su final (`uiZoomHoldEnd`); la guía de
  escenas del storyboard automático lo explica (zoom antes de los pasos que encuadra, pasos dentro de su caja, nunca
  sobre precios).

## Verificación
- motion-graphics lint/test/build verde; muestra real del video de prueba revisada cuadro a cuadro.
