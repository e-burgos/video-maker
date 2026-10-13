# Verificación — spec-e-burgos-023 cycle-06 (2026-10-12)

Prueba: rehacer el video «cómo comprar un equipo de Display Ads» en un proyecto nuevo
(`display-ads-comprar-producto-v2`) con el mismo pedido y las mismas 17 capturas, interviniendo sólo con aprobaciones.

## Lo que el productor hizo solo
- Miró las 17 capturas y escribió una revisión de material con lo que muestra cada una; declaró tres faltantes
  (confirmación de pago, acceso activo, equipo enchufado) y los avisó arriba de la propuesta. La tarjeta Propuesta
  los muestra en un bloque de aviso (`web-material-avisos.jpg`).
- Miró las fotos de la marca antes de usarlas (`brand:<clave>`).
- Señaló solo en el storyboard una frase inventada, un texto «acceso al instante» prohibido por el brief y resaltados
  sobre precios tapados.
- Usó las cajas con nombre del brief en todos los pasos de interfaz (`tarjeta-plan-propio`, `btn-siguiente-paso`…).
- Leyó la revisión, miró los cuadros por escena y la registró; tomó el crítico de duración (83,4 s vs 80 prometidos) y
  propuso recortes sin perder guion.
- Con el criterio «todo lo que nombra la voz se ve», extrajo más cuadros, encontró que el Easy Pro no aparecía y lo
  resolvió con una escena por producto.
- Resultado: 79,5 s, revisión `pass`, revisión visual en castellano, 11 escenas ok (`v2-hoja-de-contacto.jpg`,
  `v2-escena-easy-pro.jpg`, `highlight-sobrio.jpg`).

## Fallas del estudio halladas en la prueba (corregidas en el ciclo)
- `write_motion_brief` del productor no aceptaba `boxes`: el primer storyboard volvió a estimar posiciones.
- `get_render_review` rechazaba el reporte real (`version`, `delivery` fuera del esquema estricto) y el productor
  concluyó que la revisión no estaba disponible.
- La revisión tomaba la voz de una copia vieja del storyboard (`work/motion/storyboard.json`): dos falsos `fix`.
  Ahora sale de `work/motion/voice-manifest.json` (lo sintetizado).
- El prompt no decía que todo lo que nombra la voz debe verse ni que las revisiones van en el idioma del usuario.

## Intervenciones (no sólo aprobaciones)
- Avisar que el estudio ya aceptaba cajas, que la revisión ya funcionaba y que los dos `fix` eran falsos (fallas del
  estudio).
- Una pista sin nombrar la escena: «hay al menos una escena donde la voz nombra algo que no se ve».

## Lo que todavía no está bien
- El productor no usa zoom en las escenas de interfaz: las capturas ocupan ~55 % del ancho y el texto queda chico,
  aunque la revisión visual las marcó legibles.
- La verificación de material no detecta por sí sola cuando la voz nombra algo que el cuadro del medio no muestra
  (sólo hay un cuadro por escena).
- El turno del productor que hace storyboard + voz + muestra + render supera los 30 minutos y se corta.
