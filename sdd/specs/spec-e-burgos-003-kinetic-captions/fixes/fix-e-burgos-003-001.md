# FIX-e-burgos-003-001 — Captions: la palabra enfatizada pisa a sus vecinas y las palabras largas se salen del cuadro

| Campo         | Valor                              |
| ------------- | ---------------------------------- |
| **ID**        | FIX-e-burgos-003-001               |
| **Tipo**      | BUGFIX                             |
| **Severidad** | high                               |
| **Keyword**   | [BUGFIX]                           |
| **Fecha**     | 2026-09-10                         |
| **Autor**     | e-burgos                           |
| **Estado**    | implemented                        |
| **Spec**      | spec-e-burgos-003-kinetic-captions |
| **Origen**    | Primer render real (`media/demo-espacio`), reportado por el dev con captura |

## Problema

En el render real, "HAY" queda tapada por "VOLCANES", "NADIE" y "CONOCE." se tocan y "CONOCEMOS." se
sale por el borde izquierdo. `captionWordStyle` agranda la palabra enfatizada y la activa con
`transform: scale()`, que **no ocupa espacio de layout**: el flex separa a las vecinas como si la palabra
fuera chica. `fitCaptionFontSize` mide la línea con anchos sin escalar, así que la palabra enfatizada
(hasta 1,21×) no entra en la caja para la que se calculó el tamaño.

## Solución

1. `captionWordStyle` recibe el largo de la palabra y reserva en el layout el ancho extra del escalado
   con márgenes horizontales `((escala − 1) / 2) × ancho estimado de la palabra`. El `transform` se
   mantiene (los tests de escala y D-12 siguen vigentes; el contenedor sigue siendo dueño de `fontSize`).
2. `fitCaptionFontSize` acepta `emphasisIndex` opcional y, cuando lo recibe, mide la palabra enfatizada
   con `emphasisScale` y reserva el peor caso de la palabra activa (`activeScale`) sobre la palabra más
   ancha. Sin `emphasisIndex` se comporta igual que antes (compatibilidad con los llamadores y tests).
3. `captionClipPlan` pasa el `emphasisIndex` y `KineticCaptions` pasa el largo de cada palabra.

## Justificación del bypass del SPEC GATE

Defecto visual confirmado en todo render real con los presets por defecto; helpers puros y cableado del
componente, sin cambio de contrato. Perfil `solo`, sin ciclo abierto.

## Verificación

`pnpm nx run-many -t lint test build -p composition-remotion` en verde con tests nuevos: los márgenes
crecen con la escala y el largo de la palabra y son cero para la palabra normal; con `emphasisIndex` el
tamaño de fuente es estrictamente menor que sin él; y el render real de `media/demo-espacio` sin
solapamientos en los frames que fallaban (6 s, 12 s, 19 s y "HAY VOLCANES TRES").
