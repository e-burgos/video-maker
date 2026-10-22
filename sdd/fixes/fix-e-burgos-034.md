# FIX-e-burgos-034 — Motion: scroll de capturas en los marcos, monitor + tablet + celular juntos y animaciones ilustradas

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-034 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-22 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En los clips de desarrollo web la frase «se adapta a cualquier pantalla» mostraba capturas recortadas en una galería, los marcos de celular y tablet mostraban capturas quietas y los íconos grandes no ilustraban lo que decía la voz.

## Solución
- Pantalla `image` con `scroll: true`: la captura de página completa baja sola dentro del marco durante la escena.
- Visual `devices`: la misma web en monitor, tablet y celular a la vez (`images: [escritorio, tablet, celular]`), con scroll escalonado.
- Visual `animation` con seis ilustraciones animadas propias (`delivery`, `payment`, `orders`, `secure-cloud`, `domain`, `publish`), sincronizadas con la palabra de la voz (`cue`).

## Verificación
- motion-graphics, producer-tools y render-api lint/test en verde.
- Los 3 clips verticales de desarrollo web renderizados en el studio y revisados cuadro por cuadro (revisión visual pass).
