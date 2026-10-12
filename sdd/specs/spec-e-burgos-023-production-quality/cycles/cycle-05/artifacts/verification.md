# Verificación — spec-e-burgos-023 cycle-05 (2026-10-12)

## Studio real (rama feat/production-quality-reference, reiniciado con el código del ciclo)
- Se subió la presentación de Display Ads (motion, 84,4 s, 11 escenas con transiciones suaves) como referencia de
  `cafe-aroma-demo` (`PUT /projects/cafe-aroma-demo/assets/reference/presentacion-display-ads.mp4`).
- Biblioteca → "Analizar referencia": etapas visibles ("Whisper está transcribiendo la voz.") y panel completo:
  1 min 24 s, 1920×1080 a 30 fps, **11 escenas**, 7,1 cortes por minuto, escena mediana 7,8 s, 125 palabras por
  minuto, habla en el 59%, -14,9 LUFS, transcripción en 18 frases con tiempos y las 11 miniaturas cargadas
  (`web-referencia-escenas.jpg`, `web-referencia-transcripcion.jpg`).
- `GET /projects/cafe-aroma-demo/references` devuelve el resumen; las miniaturas se sirven como `image/jpeg`.

## Hallazgos corregidos durante la verificación
- Con umbral fijo 0,3 la misma presentación salía como **1 escena**: el detector sólo veía cortes secos. Se reemplazó
  por puntajes muestreados a 4 cuadros/s con umbral adaptativo (media + 2 desvíos, entre 0,05 y 0,3) y escena mínima
  de 1,5 s. Resultado: presentación 11 escenas (8 cortes en el segundo exacto, uno extra al final del fundido de
  entrada en 1,75 s); tutorial grabado de analíticas 5 (bumpers + 2 cambios de pantalla); material crudo 2.
- En proyectos motion la Biblioteca sólo mostraba fotos: se sumó la sección y el uploader de referencia.

## Fuera de esta verificación
- Turno real del productor con `get_reference_brief` (cubierto por los tests de handlers y del servidor MCP; el turno
  real consume la suscripción).
