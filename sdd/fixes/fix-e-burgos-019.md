# FIX-e-burgos-019 — Escenas de interfaz legibles: captura más grande y cámara que sigue la acción

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
- Cámara que sigue la acción: sin paso `zoom` en la escena, cada paso (caja o punto) tiene su propia región de foco,
  rellena un 8 %, cuadrada en proporción de la captura, de lado mínimo 0.45 (escala máx. ~2.2) y dentro de la captura;
  si necesita ≥ 0.85 del lado el cuadro es vista completa. Pasos consecutivos con ventanas que se solapan ≥ 60 % y
  escalas parecidas (razón ≤ 1.25) comparten cuadro clave. En el runtime (`ui-autocamera`) la cámara entra al primer
  paso, se desplaza entre pasos con transiciones de hasta 0.75 s (power2.inOut) que llegan justo antes de cada acción
  y se queda en la última región hasta el final de la escena. Un paso `zoom` explícito (FIX-017) o `autoZoom: false`
  la desactivan.
- Los globos de las llamadas mantienen su tamaño en pantalla: el texto vive en `.mg-ui-bubble-body`, que recibe la escala
  inversa de la cámara animada en sincronía con ella.
- La guía de escenas del storyboard automático explica que el estudio encuadra solo.

## Verificación
- motion-graphics y motion-studio lint/test/build verde; geometría pura probada en `ui-auto-zoom.spec.ts` y atributos
  HTML en `render-scene.spec.ts`; muestra real del storyboard v2 en
  `sdd/specs/spec-e-burgos-023-production-quality/cycles/cycle-06/artifacts/zoom-automatico.jpg`.
