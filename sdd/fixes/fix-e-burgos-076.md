# FIX-e-burgos-076 — Textos en pantalla en el modo A

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-076 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Los tutoriales del modo A (montaje con Remotion) no tenían títulos de capítulo, lower thirds ni texto cinético. Es la etapa 5 del informe `docs/research/2026-11-10-motion-graphics-productor.md`.

## Solución
- **Piezas:** tres componentes adaptados de Onda (`degueba/onda`, MIT), con el aviso en `libs/composition-remotion/src/components/text-overlays/THIRD_PARTY_NOTICE.md`. No usan el nombre ni el logo de Onda.
  - Lower third: `slide-underline`, `accent-bar` y `plate-wipe`.
  - Título de capítulo: `blur-rise`, `mask-wipe` y `word-stagger`.
  - Texto cinético: `word-rise`, `word-pop` y `word-blur`.
- **Rotación:** la variante rota con semilla por video y nunca repite la del texto anterior del mismo tipo. Si el pedido trae `variant`, se respeta.
- **Marca:** tipografía y colores salen del `captionTheme` (el montaje con marca siempre lo trae). Sin marca, el acento sale del estilo de bumpers.
- **Lugar:** cada tipo va a un margen de la zona segura:
  - lower third: abajo a la izquierda, por encima de la banda de subtítulos;
  - capítulo y texto cinético: arriba al centro.
  - El ancho es acotado, la placa es semitransparente y entra junto con el texto. Dos textos no pueden estar en pantalla a la vez.
- **Timeline:** `textOverlays`, opcional. El schema valida el tipo de cada variante, el rango, los ids repetidos y los textos que se pisan.
- **Productor:** `patch_timeline` acepta la sección `textOverlays` (`null` la borra). El prompt explica cuándo usarla y le pide dejar `variant` y `placement` afuera.
- **Web:** la vista del proyecto suma «textos en pantalla» para agregar, editar y quitar textos. Además, `timelineDocumentsEqual` ya no revienta con una timeline inválida a medio editar; antes pasaba también vaciando una palabra de subtítulo.

## Verificación
- `nx test`, `lint` y `build` en verde:

| Proyecto | Tests |
| --- | --- |
| timeline-core | 478 |
| composition-remotion | 394 |
| producer-tools | 452 |
| web | 1664 |

- Render de prueba de `media/prueba-titulos-a` (copia de un tutorial grabado), revisado cuadro a cuadro: seis textos, dos por tipo.
  - Hecho por la revisión: la placa abría vacía antes que el texto, y el capítulo arriba a la izquierda tapaba el menú lateral. Ahora la placa abre con curva in-out junto con el texto, y el capítulo va arriba al centro.
