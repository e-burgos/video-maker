# FIX-e-burgos-019 — Escenas de interfaz legibles: captura más grande y encuadre automático

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-019 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-12 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el video de prueba "comprar producto" las escenas `ui-walkthrough` mostraban la captura de 1920×1080 a ~55 % del ancho
  del video y el texto de la interfaz quedaba chico; el productor no agregó pasos `zoom` y la revisión visual igual las
  dio por legibles.

## Solución
- Marco de escena de interfaz más compacto (`.mg-frame.ui`: márgenes y título menores) y escenario más alto: la captura
  pasa de ~55 % a ~70 % del ancho con título y ~77 % sin título (16:9; 9:16 y teléfono sin cambios).
- Encuadre automático: sin paso `zoom` en la escena, el estudio calcula la unión de las cajas y puntos de los pasos
  (puntos con radio, globos con su espacio), la rellena un 7 % por lado, la lleva a la proporción del cuadro visible,
  la mantiene dentro de la captura y, si ocupa menos del 70 %, aplica un zoom persistente (escala 1.15–2.2) que entra
  0.5 s después del inicio de la escena y se mantiene hasta el final. Un paso `zoom` explícito (FIX-017) lo desactiva;
  `autoZoom: false` en la escena también.
- La guía de escenas del storyboard automático explica que el estudio encuadra solo.

## Verificación
- motion-graphics y motion-studio lint/test/build verde; geometría pura probada en `ui-auto-zoom.spec.ts` y atributos
  HTML en `render-scene.spec.ts`; muestra real del storyboard v2 en
  `sdd/specs/spec-e-burgos-023-production-quality/cycles/cycle-06/artifacts/zoom-automatico.jpg`.
