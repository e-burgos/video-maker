# Verificación TASK-004 — escena ui-walkthrough

Render real con el pipeline del CLI (`storyboard`, `voice` con voz Piper, `plan`, `compose`, `render`) en `.motion-work/ui-walkthrough-test/`
(`out.mp4` 16:9, `out-9x16.mp4` 9:16, ambos 17,5 s). Marca displayads, sin música. Captura: cuadro del segundo 20 de
`media/display-ads-crear-grupo/raw/aroll/crear-grupo.mp4` (pantalla Grupos). Escena 1 `ui-walkthrough` (marco browser, 6 pasos anclados a la voz),
escena 2 `cta`.

| Cuadro | Instante | Qué muestra |
| --- | --- | --- |
| `01-cursor-viaja.jpg` | 0,7 s | El marco browser con la barra y la URL ya entró; el cursor SVG viaja desde el punto del paso `move` hacia el botón "Nuevo grupo". |
| `02-clic.jpg` | 1,4 s | El cursor sobre "Nuevo grupo" y el anillo del pulso de clic centrado en el botón, alineado con el elemento de la captura. |
| `03-tipeo.jpg` | 2,8 s | La caja de tipeo cubre exactamente el buscador "Buscar grupo..." y escribe "Mostrad…" con el cursor a su lado; el texto crece por carácter. |
| `04-resaltado.jpg` | 3,9 s | El recuadro de resaltado enmarca justo la fila "Vidriera" de la tabla (ancho completo, borde y brillo accent); el cursor está sobre la fila. |
| `05-globo.jpg` | 5,0 s | El globo "Un dispositivo asignado" anclado al badge de dispositivos de Vidriera, encima del punto, dentro del cuadro de la captura; el recuadro anterior ya se apagó. |
| `06-zoom.jpg` | 6,4 s | El zoom acercó la región (buscador, cabecera y filas) escalando el contenedor de la captura; el marco y la barra del browser quedan fijos y el contenido recorta dentro del marco. |
| `07-cta.jpg` | 9,0 s | Escena `cta` siguiente: logo, tagline, botón y URL de la marca; confirma la transición y que la escena nueva convive con el resto. |
| `08-vertical-9x16.jpg` | 4,9 s | Mismo storyboard en 9:16: la captura 16:9 entra a ancho completo, y tipeo, globo y cursor siguen alineados porque el overlay se posiciona por porcentaje sobre la imagen. |

Hallazgo corregido durante la verificación: el primer paso con cue en la primera palabra de la voz generaba un tween del cursor en tiempo negativo y GSAP
desplazaba toda la línea de tiempo ~0,56 s; el viaje del cursor ahora no arranca antes del inicio de la escena.
